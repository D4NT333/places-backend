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

const PLACE_EVENT_TYPES = {
  LIKE_ADDED:
    RECOMMENDATION_EVENT_TYPES.LIKE_ADDED,
  LIKE_REMOVED:
    RECOMMENDATION_EVENT_TYPES.LIKE_REMOVED,
};

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeCount(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(
    Math.trunc(parsedValue),
    0,
  );
}

function assertPlaceCanReceiveLikes(place) {
  const moderationStatus =
    typeof place.status === "string"
      ? place.status.trim().toLowerCase()
      : "";

  const activityStatus =
    typeof place.activityStatus === "string"
      ? place.activityStatus.trim().toLowerCase()
      : "";

  if (
    place.deletedAt ||
    moderationStatus === "hidden" ||
    activityStatus === "inactive"
  ) {
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
  liked,
  now,
}) {
  const likesAdded = liked ? 1 : 0;
  const likesRemoved = liked ? 0 : 1;

  return {
    placeId,

    weekId,
    weekStartId,
    weekEndId,

    totals: {
      views: 0,

      likesAdded,
      likesRemoved,

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
        views: 0,

        likesAdded,
        likesRemoved,

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

export default async function togglePlaceLikeService({
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

  const {
    dayId,
    weekId,
    weekStartId,
    weekEndId,
  } = getPlaceMetricPeriod(now.toDate());

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
   * Este documento es la fuente de verdad:
   * si existe, el usuario dio like.
   */
  const userLikeRef = userRef
    .collection("likedPlaces")
    .doc(normalizedPlaceId);

  const interactionStateRef = placeRef
    .collection("interactionStates")
    .doc(normalizedUid);

  const weeklyMetricRef = placeRef
    .collection("weeklyMetrics")
    .doc(weekId);

  /*
   * La referencia se crea fuera de la transacción para evitar
   * eventos duplicados si Firestore vuelve a ejecutar la operación.
   */
  const eventRef = placeRef
    .collection("events")
    .doc();

  return db.runTransaction(
    async (transaction) => {
      /*
       * Primero todas las lecturas.
       */
      const [
        placeSnapshot,
        userLikeSnapshot,
        interactionStateSnapshot,
        weeklyMetricSnapshot,
        userSnapshot,
        profileSnapshot,
      ] = await Promise.all([
        transaction.get(placeRef),
        transaction.get(userLikeRef),
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

      assertPlaceCanReceiveLikes(place);

      const currentLikesCount = normalizeCount(
        place.metrics?.likesCount,
      );

      /*
       * Si el documento ya existe, el usuario ya tenía like,
       * así que ahora debemos quitarlo.
       */
      const liked = !userLikeSnapshot.exists;

      const eventType = liked
        ? PLACE_EVENT_TYPES.LIKE_ADDED
        : PLACE_EVENT_TYPES.LIKE_REMOVED;

      const updatedLikesCount = liked
        ? currentLikesCount + 1
        : Math.max(currentLikesCount - 1, 0);

      const previousLikeData =
        userLikeSnapshot.exists
          ? userLikeSnapshot.data()
          : null;

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
          eventType,
          eventId: eventRef.id,
          reverseImpact:
            previousLikeData
              ?.recommendationImpact || null,
          now,
        });

      if (liked) {
        const likeData = {
          placeId: normalizedPlaceId,
          userId: normalizedUid,

          createdAt: now,
          updatedAt: now,
        };

        if (recommendation.impact) {
          likeData.recommendationImpact =
            recommendation.impact;
        }

        transaction.set(
          userLikeRef,
          likeData,
        );
      } else {
        transaction.delete(userLikeRef);
      }

      /*
       * Usamos el valor exacto calculado dentro de la transacción.
       * Así evitamos que el contador pueda quedar negativo.
       */
      transaction.update(placeRef, {
        "metrics.likesCount": updatedLikesCount,

        updatedAt: now,
      });

      /*
       * interactionStates también nos permite saber rápidamente
       * si el usuario actual tiene like en este lugar.
       */
      transaction.set(
        interactionStateRef,
        {
          uid: normalizedUid,
          placeId: normalizedPlaceId,

          liked,

          lastLikeInteractionAt: now,

          createdAt:
            interactionStateSnapshot.exists
              ? interactionStateSnapshot.data()
                  ?.createdAt ?? now
              : now,

          updatedAt: now,
        },
        {
          merge: true,
        },
      );

      if (weeklyMetricSnapshot.exists) {
        const weeklyUpdates = {
          updatedAt: now,
        };

        if (liked) {
          weeklyUpdates["totals.likesAdded"] =
            FieldValue.increment(1);

          weeklyUpdates[
            `days.${dayId}.likesAdded`
          ] = FieldValue.increment(1);
        } else {
          weeklyUpdates["totals.likesRemoved"] =
            FieldValue.increment(1);

          weeklyUpdates[
            `days.${dayId}.likesRemoved`
          ] = FieldValue.increment(1);
        }

        transaction.update(
          weeklyMetricRef,
          weeklyUpdates,
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
            liked,
            now,
          }),
        );
      }

      transaction.set(eventRef, {
        eventId: eventRef.id,
        placeId: normalizedPlaceId,

        type: eventType,

        actor: {
          type: "user",
          uid: normalizedUid,
        },

        source: {
          app: "mobile",
          screen: "PlaceDetailScreen",
        },

        metadata: {
          liked,
          likesCount: updatedLikesCount,
          recommendationUpdated:
            recommendation.updated,
          recommendationApplied:
            recommendation.applied || false,
          recommendationTarget:
            recommendation.target || null,
        },

        period: {
          weekId,
          dayId,
        },

        createdAt: now,
      });

      return {
        liked,
        likesCount: updatedLikesCount,

        eventType,

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
}
