import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const PLACES_COLLECTION =
  "places";

/*
 * Único lugar que será procesado por este job.
 */
const TARGET_PLACE_ID =
  "1sHxSkZlCNaMfMh16T5i";

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toPositiveNumber(
  value,
  fallback,
) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

function getCurrentWeekId(
  date = new Date(),
) {
  /*
   * Obtenemos el lunes de la semana actual.
   */
  const currentDate =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );

  const currentDay =
    currentDate.getUTCDay();

  const daysSinceMonday =
    currentDay === 0
      ? 6
      : currentDay - 1;

  currentDate.setUTCDate(
    currentDate.getUTCDate() -
      daysSinceMonday,
  );

  return currentDate
    .toISOString()
    .slice(0, 10);
}

function timestampToMilliseconds(
  value,
) {
  if (!value) {
    return null;
  }

  if (
    value instanceof Timestamp
  ) {
    return value.toMillis();
  }

  if (
    typeof value.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .getTime();
  }

  if (
    value instanceof Date
  ) {
    return value.getTime();
  }

  const parsed =
    new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function buildActivityCheckpoint(
  weekId,
) {
  return {
    weekId,

    views:
      0,

    likesAdded:
      0,

    reviewsCreated:
      0,

    validSessions:
      0,

    communityConfirmationUserIds:
      [],

    /*
     * Permite conocer cuándo se reinició
     * el checkpoint por última vez.
     */
    updatedAt:
      FieldValue.serverTimestamp(),
  };
}

function shouldResetCheckpoint({
  place,
  mode,
  currentWeekId,
  nowMs,
  demoIntervalMs,
}) {
  const checkpoint =
    place.activityCheckpoint &&
    typeof place.activityCheckpoint ===
      "object"
      ? place.activityCheckpoint
      : {};

  if (mode === "demo") {
    const lastCheckpointUpdateMs =
      timestampToMilliseconds(
        checkpoint.updatedAt,
      ) ??
      timestampToMilliseconds(
        place.createdAt,
      ) ??
      timestampToMilliseconds(
        place.updatedAt,
      );

    /*
     * Si no existe ninguna fecha confiable,
     * permitimos inicializarlo inmediatamente.
     */
    if (
      lastCheckpointUpdateMs ===
      null
    ) {
      return true;
    }

    return (
      nowMs -
        lastCheckpointUpdateMs >=
      demoIntervalMs
    );
  }

  /*
   * En modo semanal solamente reiniciamos
   * cuando el weekId almacenado es distinto
   * al lunes de la semana actual.
   */
  const storedWeekId =
    cleanText(
      checkpoint.weekId,
    );

  return (
    storedWeekId !==
    currentWeekId
  );
}

export default async function resetPlacesActivityCheckpointsService() {
  const mode =
    cleanText(
      process.env
        .ACTIVITY_CHECKPOINT_MODE,
    ).toLowerCase() ===
    "demo"
      ? "demo"
      : "weekly";

  const demoMinutes =
    toPositiveNumber(
      process.env
        .ACTIVITY_CHECKPOINT_DEMO_MINUTES,
      10,
    );

  const demoIntervalMs =
    demoMinutes *
    60 *
    1000;

  const currentDate =
    new Date();

  const nowMs =
    currentDate.getTime();

  const currentWeekId =
    getCurrentWeekId(
      currentDate,
    );

  const result = {
    targetPlaceId:
      TARGET_PLACE_ID,

    mode,

    currentWeekId,

    demoMinutes:
      mode === "demo"
        ? demoMinutes
        : null,

    processedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    notFoundCount: 0,
  };

  /*
   * Se obtiene directamente el lugar objetivo.
   * No se consulta toda la colección.
   */
  const placeReference =
    db
      .collection(
        PLACES_COLLECTION,
      )
      .doc(
        TARGET_PLACE_ID,
      );

  const placeSnapshot =
    await placeReference.get();

  if (
    !placeSnapshot.exists
  ) {
    result.notFoundCount = 1;

    return {
      ...result,

      message:
        "El lugar objetivo no existe.",
    };
  }

  result.processedCount = 1;

  const wasUpdated =
    await db.runTransaction(
      async (
        transaction,
      ) => {
        const freshSnapshot =
          await transaction.get(
            placeReference,
          );

        if (
          !freshSnapshot.exists
        ) {
          return false;
        }

        const place =
          freshSnapshot.data();

        /*
         * No procesamos documentos eliminados.
         */
        if (
          place.deletedAt
        ) {
          return false;
        }

        const shouldReset =
          shouldResetCheckpoint({
            place,
            mode,
            currentWeekId,
            nowMs,
            demoIntervalMs,
          });

        if (
          !shouldReset
        ) {
          return false;
        }

        transaction.update(
          freshSnapshot.ref,
          {
            activityCheckpoint:
              buildActivityCheckpoint(
                currentWeekId,
              ),

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
        );

        return true;
      },
    );

  if (
    wasUpdated
  ) {
    result.updatedCount = 1;
  } else {
    result.skippedCount = 1;
  }

  return {
    ...result,

    message:
      wasUpdated
        ? "El checkpoint del lugar objetivo fue reiniciado."
        : "El checkpoint del lugar objetivo todavía no necesitaba reiniciarse.",
  };
}