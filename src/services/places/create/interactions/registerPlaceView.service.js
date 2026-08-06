import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { db } from "../../../../config/firebase.js";

import {
  RECOMMENDATION_EVENT_TYPES,
  RECOMMENDATION_PROFILE_DOCUMENT,
} from "../../../../config/recommendations/recommendationProfile.config.js";

import applyRecommendationEventService from "../../../recommendations/applyRecommendationEvent.service.js";

import getPlaceMetricPeriod from "../../../../utils/getPlaceMetricPeriod.js";

const VIEW_COOLDOWN_SECONDS = 3 * 60;
const VIEW_COOLDOWN_MILLISECONDS =
  VIEW_COOLDOWN_SECONDS * 1000;

const PLACE_EVENT_TYPE = {
  VIEW: RECOMMENDATION_EVENT_TYPES.PLACE_VIEW,
};

function createHttpError(
  message,
  statusCode,
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeCount(value) {
  const count = Number(value);

  if (!Number.isFinite(count)) {
    return 0;
  }

  return Math.max(
    Math.trunc(count),
    0,
  );
}

function getTimestampMilliseconds(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return null;
}

function assertPlaceCanReceiveViews(place) {
  if (place.deletedAt) {
    throw createHttpError(
      "El lugar solicitado no está disponible.",
      404,
    );
  }

  const status =
    typeof place.status === "string"
      ? place.status.trim().toLowerCase()
      : "published";

  if (status === "hidden") {
    throw createHttpError(
      "El lugar solicitado no está disponible.",
      404,
    );
  }
}

function createInitialWeeklyMetric({
  placeId,
  weekId,
  weekStartId,
  weekEndId,
  dayId,
  now,
}) {
  return {
    placeId,

    weekId,
    weekStartId,
    weekEndId,

    totals: {
      views: 1,

      likesAdded: 0,
      likesRemoved: 0,

      savesAdded: 0,
      savesRemoved: 0,

      shares: 0,

      reviewsCreated: 0,
      reviewsDeleted: 0,

      reportsCreated: 0,

      photoProposalsCreated: 0,
      descriptionProposalsCreated: 0,

      dwellTimeSeconds: 0,
      validSessions: 0,
    },

    days: {
      [dayId]: {
        views: 1,

        likesAdded: 0,
        likesRemoved: 0,

        savesAdded: 0,
        savesRemoved: 0,

        shares: 0,

        reviewsCreated: 0,
        reviewsDeleted: 0,

        reportsCreated: 0,

        photoProposalsCreated: 0,
        descriptionProposalsCreated: 0,

        dwellTimeSeconds: 0,
        validSessions: 0,
      },
    },

    createdAt: now,
    updatedAt: now,
  };
}

export default async function registerPlaceViewService({
  placeId,
  uid,
}) {
  if (
    typeof placeId !== "string" ||
    !placeId.trim()
  ) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  if (
    typeof uid !== "string" ||
    !uid.trim()
  ) {
    throw createHttpError(
      "El usuario autenticado es obligatorio.",
      401,
    );
  }

  const normalizedPlaceId = placeId.trim();
  const normalizedUid = uid.trim();

  const now = Timestamp.now();
  const nowMilliseconds = now.toMillis();

  const {
    dayId,
    weekId,
    weekStartId,
    weekEndId,
  } = getPlaceMetricPeriod(
    now.toDate(),
  );

  const placeRef = db
    .collection("places")
    .doc(normalizedPlaceId);

  const userRef = db
    .collection("user")
    .doc(normalizedUid);

  const profileRef = userRef
    .collection(
      RECOMMENDATION_PROFILE_DOCUMENT
        .subcollection,
    )
    .doc(
      RECOMMENDATION_PROFILE_DOCUMENT
        .documentId,
    );

  /*
   * Este documento servirá después para más interacciones,
   * no solamente para las vistas.
   */
  const interactionStateRef = placeRef
    .collection("interactionStates")
    .doc(normalizedUid);

  const weeklyMetricRef = placeRef
    .collection("weeklyMetrics")
    .doc(weekId);

  /*
   * Creamos la referencia antes de la transacción.
   *
   * Si Firestore vuelve a ejecutar la transacción debido a una
   * colisión, se utilizará el mismo ID y no se duplicará el evento.
   */
  const eventRef = placeRef
    .collection("events")
    .doc();

  const result = await db.runTransaction(
    async (transaction) => {
      /*
       * Todas las lecturas ocurren antes de cualquier escritura.
       */
      const [
        placeSnapshot,
        interactionStateSnapshot,
        weeklyMetricSnapshot,
        userSnapshot,
        profileSnapshot,
      ] = await Promise.all([
        transaction.get(placeRef),
        transaction.get(interactionStateRef),
        transaction.get(weeklyMetricRef),
        transaction.get(userRef),
        transaction.get(profileRef),
      ]);

      if (!placeSnapshot.exists) {
        throw createHttpError(
          "El lugar solicitado no existe.",
          404,
        );
      }

      const place = placeSnapshot.data();

      assertPlaceCanReceiveViews(place);

      const interactionState =
        interactionStateSnapshot.exists
          ? interactionStateSnapshot.data()
          : null;

      const lastCountedViewMilliseconds =
        getTimestampMilliseconds(
          interactionState?.lastCountedViewAt,
        );

      const elapsedMilliseconds =
        lastCountedViewMilliseconds === null
          ? null
          : nowMilliseconds -
            lastCountedViewMilliseconds;

      const viewCanBeCounted =
        elapsedMilliseconds === null ||
        elapsedMilliseconds >=
          VIEW_COOLDOWN_MILLISECONDS;

      const currentViewsCount = normalizeCount(
        place.metrics?.viewsCount,
      );

      /*
       * Entró nuevamente antes de que terminara el cooldown.
       *
       * No hacemos ninguna escritura para evitar gastos y spam:
       * - No incrementamos contador.
       * - No actualizamos tendencia.
       * - No actualizamos perfil.
       * - No creamos evento.
       */
      if (!viewCanBeCounted) {
        const remainingMilliseconds =
          VIEW_COOLDOWN_MILLISECONDS -
          elapsedMilliseconds;

        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(
            remainingMilliseconds / 1000,
          ),
        );

        return {
          counted: false,

          internalReason: "view_cooldown",
          retryAfterSeconds,

          viewsCount: currentViewsCount,

          weekId,
          dayId,

          recommendation: {
            updated: false,
            reason: "view_cooldown",
          },
        };
      }

      const updatedViewsCount =
        currentViewsCount + 1;

      transaction.update(placeRef, {
        "metrics.viewsCount":
          FieldValue.increment(1),

        updatedAt: now,
      });

      transaction.set(
        interactionStateRef,
        {
          uid: normalizedUid,
          placeId: normalizedPlaceId,

          lastCountedViewAt: now,

          countedViews:
            FieldValue.increment(1),

          createdAt:
            interactionStateSnapshot.exists
              ? interactionState?.createdAt ?? now
              : now,

          updatedAt: now,
        },
        {
          merge: true,
        },
      );

      if (weeklyMetricSnapshot.exists) {
        transaction.update(
          weeklyMetricRef,
          {
            "totals.views":
              FieldValue.increment(1),

            [`days.${dayId}.views`]:
              FieldValue.increment(1),

            updatedAt: now,
          },
        );
      } else {
        transaction.set(
          weeklyMetricRef,
          createInitialWeeklyMetric({
            placeId: normalizedPlaceId,

            weekId,
            weekStartId,
            weekEndId,

            dayId,
            now,
          }),
        );
      }

      transaction.set(
        eventRef,
        {
          eventId: eventRef.id,
          placeId: normalizedPlaceId,

          type: PLACE_EVENT_TYPE.VIEW,

          actor: {
            type: "user",
            uid: normalizedUid,
          },

          source: {
            app: "mobile",
            screen: "PlaceDetailScreen",
          },

          counted: true,

          period: {
            weekId,
            dayId,
          },

          createdAt: now,
        },
      );

      const recommendation =
        applyRecommendationEventService({
          transaction,
          profileRef,
          profileSnapshot,
          userData: userSnapshot.exists
            ? userSnapshot.data()
            : null,
          uid: normalizedUid,
          place: {
            ...place,
            placeId: normalizedPlaceId,
          },
          eventType: PLACE_EVENT_TYPE.VIEW,
          eventId: eventRef.id,
          now,
        });

      return {
        counted: true,

        internalReason: null,
        retryAfterSeconds: 0,

        viewsCount: updatedViewsCount,

        weekId,
        dayId,

        recommendation: {
          updated: recommendation.updated,
          applied: recommendation.applied,
          reason: recommendation.reason,
          target: recommendation.target || null,
          dominantProfileId:
            recommendation.dominantProfileId ||
            null,
          dominantSubprofileId:
            recommendation
              .dominantSubprofileId || null,
        },
      };
    },
  );

  return result;
}
