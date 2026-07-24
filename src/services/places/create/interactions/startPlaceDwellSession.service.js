import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { db } from "../../../../config/firebase.js";

const MAX_DWELL_SECONDS = 30 * 60;
const MAX_DWELL_MILLISECONDS =
  MAX_DWELL_SECONDS * 1000;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
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

function assertPlaceCanReceiveDwellTime(place) {
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

export default async function startPlaceDwellSessionService({
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

  const placeRef = db
    .collection("places")
    .doc(normalizedPlaceId);

  const interactionStateRef = placeRef
    .collection("interactionStates")
    .doc(normalizedUid);

  const newSessionRef = placeRef
    .collection("dwellSessions")
    .doc();

  return db.runTransaction(async (transaction) => {
    const placeSnapshot =
      await transaction.get(placeRef);

    const interactionStateSnapshot =
      await transaction.get(
        interactionStateRef,
      );

    if (!placeSnapshot.exists) {
      throw createHttpError(
        "El lugar solicitado no existe.",
        404,
      );
    }

    const place = placeSnapshot.data();

    assertPlaceCanReceiveDwellTime(place);

    const interactionState =
      interactionStateSnapshot.exists
        ? interactionStateSnapshot.data()
        : null;

    const activeSessionId =
      interactionState?.activeDwellSessionId ||
      null;

    const activeSessionStartedAt =
      interactionState?.activeDwellSessionStartedAt ||
      null;

    const activeStartedMilliseconds =
      getTimestampMilliseconds(
        activeSessionStartedAt,
      );

    /*
     * Si Mobile dispara dos veces el inicio de sesión
     * inmediatamente, reutilizamos la sesión existente.
     */
    if (
      activeSessionId &&
      activeStartedMilliseconds !== null &&
      nowMilliseconds -
        activeStartedMilliseconds <
        MAX_DWELL_MILLISECONDS
    ) {
      return {
        sessionId: activeSessionId,
        startedAt: activeSessionStartedAt,
        reused: true,
      };
    }

    /*
     * Si quedó una sesión vieja porque la aplicación
     * se cerró inesperadamente, la marcamos expirada.
     */
    if (activeSessionId) {
      const oldSessionRef = placeRef
        .collection("dwellSessions")
        .doc(activeSessionId);

      transaction.set(
        oldSessionRef,
        {
          status: "expired",
          expiredAt: now,
          updatedAt: now,
        },
        {
          merge: true,
        },
      );
    }

    transaction.set(newSessionRef, {
      sessionId: newSessionRef.id,
      placeId: normalizedPlaceId,
      userId: normalizedUid,

      status: "active",

      startedAt: now,
      endedAt: null,

      durationSeconds: null,
      countedDurationSeconds: null,

      counted: false,
      capped: false,

      source: {
        app: "mobile",
        screen: "PlaceDetailScreen",
      },

      createdAt: now,
      updatedAt: now,
    });

    transaction.set(
      interactionStateRef,
      {
        uid: normalizedUid,
        placeId: normalizedPlaceId,

        activeDwellSessionId:
          newSessionRef.id,

        activeDwellSessionStartedAt:
          now,

        

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

    transaction.update(placeRef, {
    
      updatedAt: now,
    });

    return {
      sessionId: newSessionRef.id,
      startedAt: now,
      reused: false,
    };
  });
}