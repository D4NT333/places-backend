import admin
  from "firebase-admin";

import {
  db,
} from "../../../../config/firebase.js";

const PLACES_COLLECTION =
  "places";

const REQUIRED_COMMUNITY_CONFIRMATIONS =
  5;

function createServiceError(
  message,
  statusCode,
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeUidArray(
  value,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) =>
          cleanText(item)
        )
        .filter(Boolean),
    ),
  ];
}

export default async function confirmPlaceActivityService({
  placeId,
  uid,
}) {
  const cleanPlaceId =
    cleanText(placeId);

  const cleanUid =
    cleanText(uid);

  if (!cleanPlaceId) {
    throw createServiceError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  if (!cleanUid) {
    throw createServiceError(
      "Debes iniciar sesión para confirmar la actividad del lugar.",
      401,
    );
  }

  const placeRef =
    db
      .collection(
        PLACES_COLLECTION,
      )
      .doc(
        cleanPlaceId,
      );

  return db.runTransaction(
    async (transaction) => {
      const placeSnapshot =
        await transaction.get(
          placeRef,
        );

      if (!placeSnapshot.exists) {
        throw createServiceError(
          "No se encontró el lugar solicitado.",
          404,
        );
      }

      const place =
        placeSnapshot.data();

      if (place.deletedAt) {
        throw createServiceError(
          "El lugar ya no está disponible.",
          404,
        );
      }

      const publicationStatus =
        cleanText(
          place.status,
        ).toLowerCase();

      if (
        publicationStatus ===
        "hidden"
      ) {
        throw createServiceError(
          "El lugar no está disponible.",
          404,
        );
      }

      const activityStatus =
        cleanText(
          place.activityStatus,
        ).toLowerCase();

      /*
       * Solamente los lugares en pending
       * pueden recibir confirmaciones.
       */
      if (
        activityStatus !==
        "pending"
      ) {
        throw createServiceError(
          "Este lugar ya no requiere confirmación de actividad.",
          409,
        );
      }

      const checkpoint =
        place.activityCheckpoint &&
        typeof place.activityCheckpoint ===
          "object"
          ? place.activityCheckpoint
          : {};

      const currentUserIds =
        normalizeUidArray(
          checkpoint
            .communityConfirmationUserIds,
        );

      const alreadyConfirmed =
        currentUserIds.includes(
          cleanUid,
        );

      /*
       * Si el usuario ya confirmó, no se vuelve
       * a sumar ni se modifica el documento.
       */
      if (alreadyConfirmed) {
        return {
          alreadyConfirmed:
            true,

          becameActive:
            false,

          activityStatus:
            "pending",

          confirmationsCount:
            currentUserIds.length,

          requiredConfirmations:
            REQUIRED_COMMUNITY_CONFIRMATIONS,

          canConfirm:
            false,
        };
      }

      const nextUserIds = [
        ...currentUserIds,
        cleanUid,
      ];

      const confirmationsCount =
        nextUserIds.length;

      const becameActive =
        confirmationsCount >=
        REQUIRED_COMMUNITY_CONFIRMATIONS;

      const now =
        admin.firestore
          .FieldValue
          .serverTimestamp();

      const placeUpdate = {
        "activityCheckpoint.communityConfirmationUserIds":
          nextUserIds,

        lastInteractionAt:
          now,

        updatedAt:
          now,
      };

      /*
       * La quinta confirmación revive el lugar.
       */
      if (becameActive) {
        placeUpdate.activityStatus =
          "active";

        placeUpdate.activityStatusUpdatedAt =
          now;

        placeUpdate.lastActivityRecoveryAt =
          now;

        placeUpdate.lastActivityRecoveryReason =
          "community_confirmations";

        placeUpdate.confirmationStartedAt =
          null;
      }

      transaction.update(
        placeRef,
        placeUpdate,
      );

      return {
        alreadyConfirmed:
          false,

        becameActive,

        activityStatus:
          becameActive
            ? "active"
            : "pending",

        confirmationsCount,

        requiredConfirmations:
          REQUIRED_COMMUNITY_CONFIRMATIONS,

        canConfirm:
          false,
      };
    },
  );
}