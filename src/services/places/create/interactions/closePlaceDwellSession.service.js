import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { db } from "../../../../config/firebase.js";

import getPlaceMetricPeriod from "../../../../utils/getPlaceMetricPeriod.js";

import {
  RECOMMENDATION_DWELL_CONFIG,
  RECOMMENDATION_EVENT_TYPES,
  RECOMMENDATION_PROFILE_DOCUMENT,
} from "../../../../config/recommendations/recommendationProfile.config.js";

import applyRecommendationEventService from "../../../recommendations/applyRecommendationEvent.service.js";

const MIN_DWELL_SECONDS = 3;
const MAX_DWELL_SECONDS = 30 * 60;

const PLACE_EVENT_TYPES = {
  DWELL_TIME_RECORDED:
    "place_dwell_time_recorded",
};

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
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

function createInitialWeeklyMetric({
  placeId,
  weekId,
  weekStartId,
  weekEndId,
  dayId,
  countedDurationSeconds,
  now,
}) {
  return {
    placeId,

    weekId,
    weekStartId,
    weekEndId,

    totals: {
      views: 0,

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

      dwellTimeSeconds:
        countedDurationSeconds,

      validSessions: 1,

      averageDwellTimeSeconds:
        countedDurationSeconds,
    },

    days: {
      [dayId]: {
        views: 0,

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

        dwellTimeSeconds:
          countedDurationSeconds,

        validSessions: 1,

        averageDwellTimeSeconds:
          countedDurationSeconds,
      },
    },

    createdAt: now,
    updatedAt: now,
  };
}

export default async function closePlaceDwellSessionService({
  placeId,
  sessionId,
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
    typeof sessionId !== "string" ||
    !sessionId.trim()
  ) {
    throw createHttpError(
      "El identificador de la sesión es obligatorio.",
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
  const normalizedSessionId = sessionId.trim();
  const normalizedUid = uid.trim();

  const now = Timestamp.now();
  const nowMilliseconds = now.toMillis();

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

  const sessionRef = placeRef
    .collection("dwellSessions")
    .doc(normalizedSessionId);

  const interactionStateRef = placeRef
    .collection("interactionStates")
    .doc(normalizedUid);

  const eventRef = placeRef
    .collection("events")
    .doc();

  return db.runTransaction(async (transaction) => {
    const sessionSnapshot =
      await transaction.get(sessionRef);

    if (!sessionSnapshot.exists) {
      throw createHttpError(
        "La sesión de permanencia no existe.",
        404,
      );
    }

    const session = sessionSnapshot.data();

    if (session.userId !== normalizedUid) {
      throw createHttpError(
        "La sesión no pertenece al usuario autenticado.",
        403,
      );
    }

    /*
     * Cierre idempotente:
     * si Mobile intenta cerrarla dos veces, no duplicamos
     * métricas ni eventos.
     */
    if (session.status === "closed") {
      return {
        sessionId: normalizedSessionId,

        durationSeconds:
          normalizeCount(
            session.durationSeconds,
          ),

        countedDurationSeconds:
          normalizeCount(
            session.countedDurationSeconds,
          ),

        counted: Boolean(session.counted),
        capped: Boolean(session.capped),

        alreadyClosed: true,

        recommendation: {
          updated: false,
          reason: "session_already_closed",
        },
      };
    }

    if (session.status !== "active") {
      throw createHttpError(
        "La sesión ya no se encuentra activa.",
        409,
      );
    }

    const startedAtMilliseconds =
      getTimestampMilliseconds(
        session.startedAt,
      );

    if (startedAtMilliseconds === null) {
      throw createHttpError(
        "La sesión no tiene una fecha de inicio válida.",
        500,
      );
    }

    const rawDurationMilliseconds =
      Math.max(
        nowMilliseconds -
          startedAtMilliseconds,
        0,
      );

    const durationSeconds =
      Math.floor(
        rawDurationMilliseconds / 1000,
      );

    const counted =
      durationSeconds >=
      MIN_DWELL_SECONDS;

    const capped =
      durationSeconds >
      MAX_DWELL_SECONDS;

    const countedDurationSeconds =
      counted
        ? Math.min(
            durationSeconds,
            MAX_DWELL_SECONDS,
          )
        : 0;

    /*
     * Las métricas cuentan desde 3 segundos.
     * El perfil solamente se modifica cuando la
     * permanencia alcanza el mínimo configurado,
     * que debe ser 30 segundos.
     */
    const recommendationCanBeApplied =
      durationSeconds >=
      RECOMMENDATION_DWELL_CONFIG
        .minimumValidSeconds;

    /*
     * La sesión se atribuye al día y semana en que comenzó.
     */
    const {
      dayId,
      weekId,
      weekStartId,
      weekEndId,
    } = getPlaceMetricPeriod(
      session.startedAt.toDate(),
    );

    const weeklyMetricRef = placeRef
      .collection("weeklyMetrics")
      .doc(weekId);

    /*
     * Todas las lecturas se hacen antes
     * de comenzar con las escrituras.
     */
    const [
      placeSnapshot,
      weeklyMetricSnapshot,
      interactionStateSnapshot,
      userSnapshot,
      profileSnapshot,
    ] = await Promise.all([
      transaction.get(placeRef),
      transaction.get(weeklyMetricRef),
      transaction.get(interactionStateRef),
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

    transaction.update(sessionRef, {
      status: "closed",

      endedAt: now,

      durationSeconds,
      countedDurationSeconds,

      counted,
      capped,

      period: {
        weekId,
        dayId,
      },

      updatedAt: now,
    });

    transaction.set(
      interactionStateRef,
      {
        uid: normalizedUid,
        placeId: normalizedPlaceId,

        activeDwellSessionId:
          FieldValue.delete(),

        activeDwellSessionStartedAt:
          FieldValue.delete(),

        lastDwellSessionId:
          normalizedSessionId,

        lastDwellDurationSeconds:
          durationSeconds,

        lastCountedDwellSeconds:
          countedDurationSeconds,

        lastDwellSessionEndedAt:
          now,

        lastInteractionAt:
          now,

        createdAt:
          interactionStateSnapshot.exists
            ? interactionStateSnapshot
                .data()?.createdAt ?? now
            : now,

        updatedAt: now,
      },
      {
        merge: true,
      },
    );

    /*
     * Las sesiones demasiado cortas se guardan,
     * pero no modifican las estadísticas.
     */
    if (!counted) {
      return {
        sessionId: normalizedSessionId,

        durationSeconds,
        countedDurationSeconds: 0,

        counted: false,
        capped: false,

        alreadyClosed: false,

        weekId,
        dayId,

        recommendation: {
          updated: false,
          reason: "dwell_too_short_for_metrics",
        },
      };
    }

    if (weeklyMetricSnapshot.exists) {
      const weeklyMetric =
        weeklyMetricSnapshot.data();

      const currentWeeklySeconds =
        normalizeCount(
          weeklyMetric
            .totals
            ?.dwellTimeSeconds,
        );

      const currentWeeklySessions =
        normalizeCount(
          weeklyMetric
            .totals
            ?.validSessions,
        );

      const updatedWeeklySeconds =
        currentWeeklySeconds +
        countedDurationSeconds;

      const updatedWeeklySessions =
        currentWeeklySessions + 1;

      const updatedWeeklyAverage =
        updatedWeeklySessions > 0
          ? updatedWeeklySeconds /
            updatedWeeklySessions
          : 0;

      const currentDay =
        weeklyMetric.days?.[dayId] ||
        {};

      const currentDaySeconds =
        normalizeCount(
          currentDay.dwellTimeSeconds,
        );

      const currentDaySessions =
        normalizeCount(
          currentDay.validSessions,
        );

      const updatedDaySeconds =
        currentDaySeconds +
        countedDurationSeconds;

      const updatedDaySessions =
        currentDaySessions + 1;

      const updatedDayAverage =
        updatedDaySessions > 0
          ? updatedDaySeconds /
            updatedDaySessions
          : 0;

      transaction.update(
        weeklyMetricRef,
        {
          "totals.dwellTimeSeconds":
            updatedWeeklySeconds,

          "totals.validSessions":
            updatedWeeklySessions,

          "totals.averageDwellTimeSeconds":
            updatedWeeklyAverage,

          [`days.${dayId}.dwellTimeSeconds`]:
            updatedDaySeconds,

          [`days.${dayId}.validSessions`]:
            updatedDaySessions,

          [`days.${dayId}.averageDwellTimeSeconds`]:
            updatedDayAverage,

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

          countedDurationSeconds,

          now,
        }),
      );
    }

    /*
     * Solo las permanencias de 30 segundos o más
     * actualizan el perfil del usuario.
     */
    const recommendation =
      recommendationCanBeApplied
        ? applyRecommendationEventService({
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

            eventType:
              RECOMMENDATION_EVENT_TYPES
                .VALID_DWELL_SESSION,

            eventId: eventRef.id,

            now,
          })
        : {
            updated: false,
            applied: false,

            reason:
              "dwell_below_recommendation_minimum",

            target: null,

            dominantProfileId: null,
            dominantSubprofileId: null,
          };

    transaction.set(eventRef, {
      eventId: eventRef.id,
      placeId: normalizedPlaceId,

      type:
        PLACE_EVENT_TYPES
          .DWELL_TIME_RECORDED,

      actor: {
        type: "user",
        uid: normalizedUid,
      },

      source: {
        app: "mobile",
        screen: "PlaceDetailScreen",
      },

      metadata: {
        sessionId:
          normalizedSessionId,

        durationSeconds,

        countedDurationSeconds,

        capped,

        recommendationEligible:
          recommendationCanBeApplied,
      },

      period: {
        weekId,
        dayId,
      },

      createdAt: now,
    });

    transaction.update(placeRef, {
      updatedAt: now,
    });

    return {
      sessionId: normalizedSessionId,

      durationSeconds,
      countedDurationSeconds,

      counted: true,
      capped,

      alreadyClosed: false,

      weekId,
      dayId,

      recommendation: {
        updated:
          recommendation.updated,

        applied:
          recommendation.applied,

        reason:
          recommendation.reason,

        target:
          recommendation.target ||
          null,

        dominantProfileId:
          recommendation
            .dominantProfileId ||
          null,

        dominantSubprofileId:
          recommendation
            .dominantSubprofileId ||
          null,
      },
    };
  });
}