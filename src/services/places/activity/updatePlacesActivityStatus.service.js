import {
  FieldPath,
  Timestamp,
} from "firebase-admin/firestore";

import { db } from "../../../config/firebase.js";

import getPlaceMetricPeriod from "../../../utils/getPlaceMetricPeriod.js";

const PLACES_COLLECTION = "places";
const WEEKLY_METRICS_COLLECTION = "weeklyMetrics";

const PAGE_SIZE = 100;

/*
 * Valores temporales para probar.
 *
 * El job puede ejecutarse cada 10 minutos:
 *
 * 10 minutos -> low_activity
 * 20 minutos -> pending
 * 30 minutos -> inactive
 *
 * Después solamente cambiamos las variables de entorno.
 */
const LOW_ACTIVITY_MINUTES = Number(
  process.env.PLACE_LOW_ACTIVITY_MINUTES || 10,
);

const PENDING_MINUTES = Number(
  process.env.PLACE_PENDING_MINUTES || 20,
);

const INACTIVE_MINUTES = Number(
  process.env.PLACE_INACTIVE_MINUTES || 30,
);

/*
 * Actividad necesaria para reiniciar el reloj.
 *
 * Solo es necesario cumplir UNA regla.
 */
const RECOVERY_RULES = {
  views: Number(
    process.env.PLACE_RECOVERY_VIEWS || 10,
  ),

  likesAdded: Number(
    process.env.PLACE_RECOVERY_LIKES || 3,
  ),

  reviewsCreated: Number(
    process.env.PLACE_RECOVERY_REVIEWS || 2,
  ),

  validSessions: Number(
    process.env.PLACE_RECOVERY_VALID_SESSIONS || 2,
  ),

  averageDwellTimeSeconds: Number(
    process.env.PLACE_RECOVERY_AVERAGE_DWELL_SECONDS || 30,
  ),
};

function normalizeNumber(value) {
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

function minutesToMilliseconds(minutes) {
  return minutes * 60 * 1000;
}

function normalizeWeeklyTotals(weeklyMetric) {
  const totals = weeklyMetric?.totals || {};

  return {
    views: normalizeNumber(
      totals.views,
    ),

    likesAdded: normalizeNumber(
      totals.likesAdded,
    ),

    reviewsCreated: normalizeNumber(
      totals.reviewsCreated,
    ),

    validSessions: normalizeNumber(
      totals.validSessions,
    ),

    averageDwellTimeSeconds:
      normalizeNumber(
        totals.averageDwellTimeSeconds,
      ),
  };
}

/*
 * El checkpoint evita que las mismas 10 vistas
 * revivan el lugar en cada ejecución del job.
 *
 * Ejemplo:
 * - Métrica actual: 10 vistas
 * - Checkpoint: 0
 * - Diferencia: 10 -> revive
 *
 * Después guardamos checkpoint=10.
 *
 * En la siguiente ejecución:
 * - Métrica actual: 10
 * - Checkpoint: 10
 * - Diferencia: 0 -> no vuelve a revivir
 */
function normalizeActivityCheckpoint({
  checkpoint,
  weekId,
}) {
  if (
    !checkpoint ||
    checkpoint.weekId !== weekId
  ) {
    return {
      weekId,

      views: 0,
      likesAdded: 0,
      reviewsCreated: 0,
      validSessions: 0,
    };
  }

  return {
    weekId,

    views: normalizeNumber(
      checkpoint.views,
    ),

    likesAdded: normalizeNumber(
      checkpoint.likesAdded,
    ),

    reviewsCreated: normalizeNumber(
      checkpoint.reviewsCreated,
    ),

    validSessions: normalizeNumber(
      checkpoint.validSessions,
    ),
  };
}

function calculateActivityDeltas({
  totals,
  checkpoint,
}) {
  return {
    views: Math.max(
      totals.views - checkpoint.views,
      0,
    ),

    likesAdded: Math.max(
      totals.likesAdded -
        checkpoint.likesAdded,
      0,
    ),

    reviewsCreated: Math.max(
      totals.reviewsCreated -
        checkpoint.reviewsCreated,
      0,
    ),

    validSessions: Math.max(
      totals.validSessions -
        checkpoint.validSessions,
      0,
    ),

    averageDwellTimeSeconds:
      totals.averageDwellTimeSeconds,
  };
}

function evaluateRecoveryReason(deltas) {
  if (
    deltas.views >=
    RECOVERY_RULES.views
  ) {
    return "views";
  }

  if (
    deltas.likesAdded >=
    RECOVERY_RULES.likesAdded
  ) {
    return "likes";
  }

  if (
    deltas.reviewsCreated >=
    RECOVERY_RULES.reviewsCreated
  ) {
    return "reviews";
  }

  const hasEnoughDwellActivity =
    deltas.validSessions >=
      RECOVERY_RULES.validSessions &&
    deltas.averageDwellTimeSeconds >=
      RECOVERY_RULES.averageDwellTimeSeconds;

  if (hasEnoughDwellActivity) {
    return "dwell_time";
  }

  return null;
}

function determineStatusByTime({
  lastInteractionAt,
  nowMilliseconds,
}) {
  const lastInteractionMilliseconds =
    getTimestampMilliseconds(
      lastInteractionAt,
    );

  /*
   * Si existe un documento viejo sin fecha,
   * no lo mandamos directamente a inactive.
   */
  if (lastInteractionMilliseconds === null) {
    return "active";
  }

  const elapsedMilliseconds = Math.max(
    nowMilliseconds -
      lastInteractionMilliseconds,
    0,
  );

  if (
    elapsedMilliseconds >=
    minutesToMilliseconds(
      INACTIVE_MINUTES,
    )
  ) {
    return "inactive";
  }

  if (
    elapsedMilliseconds >=
    minutesToMilliseconds(
      PENDING_MINUTES,
    )
  ) {
    return "pending";
  }

  if (
    elapsedMilliseconds >=
    minutesToMilliseconds(
      LOW_ACTIVITY_MINUTES,
    )
  ) {
    return "low_activity";
  }

  return "active";
}

function buildCheckpoint({
  weekId,
  totals,
}) {
  return {
    weekId,

    views: totals.views,
    likesAdded: totals.likesAdded,
    reviewsCreated:
      totals.reviewsCreated,
    validSessions:
      totals.validSessions,
  };
}

export default async function updatePlacesActivityStatusService() {
  const now = Timestamp.now();
  const nowMilliseconds = now.toMillis();

  const {
    weekId,
  } = getPlaceMetricPeriod(
    now.toDate(),
  );

  const result = {
    checked: 0,
    updated: 0,
    recovered: 0,

    changedToActive: 0,
    changedToLowActivity: 0,
    changedToPending: 0,
    changedToInactive: 0,

    recoveryReasons: {
      views: 0,
      likes: 0,
      reviews: 0,
      dwell_time: 0,
    },
  };

  let lastDocument = null;

  while (true) {
    let query = db
  .collection(PLACES_COLLECTION)
  .where(
    "status",
    "in",
    [
      "published",
      "pending",
      "warned",
    ],
  )
  .orderBy(
    FieldPath.documentId(),
  )
  .limit(PAGE_SIZE);

    if (lastDocument) {
      query = query.startAfter(
        lastDocument,
      );
    }

    const placesSnapshot =
      await query.get();

    if (placesSnapshot.empty) {
      break;
    }

    /*
     * Consultamos la métrica semanal de cada lugar.
     *
     * Para el tamaño actual del proyecto está bien.
     * Más adelante se puede optimizar si crece mucho.
     */
    const placesWithMetrics =
      await Promise.all(
        placesSnapshot.docs.map(
          async (placeDocument) => {
            const weeklyMetricDocument =
              await placeDocument.ref
                .collection(
                  WEEKLY_METRICS_COLLECTION,
                )
                .doc(weekId)
                .get();

            return {
              placeDocument,
              weeklyMetricDocument,
            };
          },
        ),
      );

    const batch = db.batch();
    let batchUpdates = 0;

    for (const {
      placeDocument,
      weeklyMetricDocument,
    } of placesWithMetrics) {
      const place =
        placeDocument.data();

      result.checked += 1;

      if (place.deletedAt) {
        continue;
      }

      const currentStatus =
        typeof place.activityStatus ===
        "string"
          ? place.activityStatus
          : "active";

      const weeklyMetric =
        weeklyMetricDocument.exists
          ? weeklyMetricDocument.data()
          : null;

      const totals =
        normalizeWeeklyTotals(
          weeklyMetric,
        );

      const checkpoint =
        normalizeActivityCheckpoint({
          checkpoint:
            place.activityCheckpoint,
          weekId,
        });

      const deltas =
        calculateActivityDeltas({
          totals,
          checkpoint,
        });

      const recoveryReason =
        evaluateRecoveryReason(
          deltas,
        );

      /*
       * Primero revisamos si alcanzó actividad suficiente.
       *
       * Esto tiene prioridad sobre la decadencia por tiempo.
       */
      if (recoveryReason) {
        const updateData = {
          activityStatus:
            "active",

          lastInteractionAt:
            now,

          activityCheckpoint:
            buildCheckpoint({
              weekId,
              totals,
            }),

          lastActivityRecoveryAt:
            now,

          lastActivityRecoveryReason:
            recoveryReason,

          confirmationStartedAt:
            null,

          updatedAt:
            now,
        };

        if (
          currentStatus !==
          "active"
        ) {
          updateData.activityStatusUpdatedAt =
            now;

          result.changedToActive += 1;
        }

        batch.update(
          placeDocument.ref,
          updateData,
        );

        batchUpdates += 1;

        result.updated += 1;
        result.recovered += 1;

        result.recoveryReasons[
          recoveryReason
        ] += 1;

        continue;
      }

      const referenceDate =
        place.lastInteractionAt ||
        place.createdAt;

      const nextStatus =
        determineStatusByTime({
          lastInteractionAt:
            referenceDate,

          nowMilliseconds,
        });

      if (
        nextStatus ===
        currentStatus
      ) {
        continue;
      }

      const updateData = {
        activityStatus:
          nextStatus,

        activityStatusUpdatedAt:
          now,

        updatedAt:
          now,
      };

      if (
        nextStatus ===
        "pending"
      ) {
        updateData.confirmationStartedAt =
          place.confirmationStartedAt ||
          now;
      }

      if (
        nextStatus ===
        "active"
      ) {
        updateData.confirmationStartedAt =
          null;
      }

      batch.update(
        placeDocument.ref,
        updateData,
      );

      batchUpdates += 1;
      result.updated += 1;

      if (
        nextStatus ===
        "active"
      ) {
        result.changedToActive += 1;
      }

      if (
        nextStatus ===
        "low_activity"
      ) {
        result.changedToLowActivity += 1;
      }

      if (
        nextStatus ===
        "pending"
      ) {
        result.changedToPending += 1;
      }

      if (
        nextStatus ===
        "inactive"
      ) {
        result.changedToInactive += 1;
      }
    }

    if (batchUpdates > 0) {
      await batch.commit();
    }

    lastDocument =
      placesSnapshot.docs[
        placesSnapshot.docs.length - 1
      ];

    if (
      placesSnapshot.size <
      PAGE_SIZE
    ) {
      break;
    }
  }

  return {
    ...result,

    configuration: {
      lowActivityMinutes:
        LOW_ACTIVITY_MINUTES,

      pendingMinutes:
        PENDING_MINUTES,

      inactiveMinutes:
        INACTIVE_MINUTES,

      recoveryRules:
        RECOVERY_RULES,

      weekId,
    },
  };
}