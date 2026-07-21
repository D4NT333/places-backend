import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const MANUAL_ACTIONS = new Set([
  "warned",
  "hidden",
]);

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    Math.trunc(parsed),
    0
  );
}

async function assertAdminUser(uid) {
  if (!uid) {
    throw createHttpError(
      "Usuario no autenticado.",
      401
    );
  }

  const adminSnapshot = await db
    .collection("adminUsers")
    .doc(uid)
    .get();

  if (!adminSnapshot.exists) {
    throw createHttpError(
      "No tienes permisos administrativos.",
      403
    );
  }

  return adminSnapshot.data();
}

export default async function moderateAdminPlaceService({
  adminUid,
  placeId,
  action,
  note,
}) {
  await assertAdminUser(adminUid);

  const normalizedPlaceId =
    cleanText(placeId);

  const normalizedAction =
    cleanText(action).toLowerCase();

  const normalizedNote =
    cleanText(note);

  if (!normalizedPlaceId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400
    );
  }

  if (
    !MANUAL_ACTIONS.has(
      normalizedAction
    )
  ) {
    throw createHttpError(
      "La acción debe ser warned o hidden.",
      400
    );
  }

  if (normalizedNote.length < 10) {
    throw createHttpError(
      "La nota administrativa debe tener al menos 10 caracteres.",
      400
    );
  }

  if (normalizedNote.length > 500) {
    throw createHttpError(
      "La nota administrativa no puede superar 500 caracteres.",
      400
    );
  }

  const placeRef = db
    .collection("places")
    .doc(normalizedPlaceId);

  const moderationActionRef = placeRef
    .collection("moderationActions")
    .doc();

  const result = await db.runTransaction(
    async (transaction) => {
      const placeSnapshot =
        await transaction.get(
          placeRef
        );

      if (!placeSnapshot.exists) {
        throw createHttpError(
          "No se encontró el lugar.",
          404
        );
      }

      const place =
        placeSnapshot.data();

      if (place.deletedAt) {
        throw createHttpError(
          "No se puede moderar un lugar eliminado.",
          409
        );
      }

      const previousStatus =
        cleanText(place.status) ||
        "published";

      if (
        previousStatus === normalizedAction
      ) {
        throw createHttpError(
          normalizedAction === "warned"
            ? "El lugar ya se encuentra advertido."
            : "El lugar ya se encuentra oculto.",
          409
        );
      }

      const validReportsCount =
        normalizeCount(
          place.moderation
            ?.validReportsCount ??
          place.metrics
            ?.validReportsCount
        );

      transaction.update(
        placeRef,
        {
          status:
            normalizedAction,

          "moderation.status":
            normalizedAction,

          /*
           * No modificamos validReportsCount.
           * La acción manual no inventa reportes.
           */
          "moderation.source":
            "manual",

          "moderation.manualAction":
            normalizedAction,

          "moderation.note":
            normalizedNote,

          "moderation.moderatedBy":
            adminUid,

          "moderation.moderatedAt":
            FieldValue.serverTimestamp(),

          "moderation.updatedAt":
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      transaction.set(
        moderationActionRef,
        {
          actionId:
            moderationActionRef.id,

          placeId:
            normalizedPlaceId,

          type:
            "manual_moderation",

          source:
            "manual",

          action:
            normalizedAction,

          previousStatus,

          nextStatus:
            normalizedAction,

          validReportsCount,

          note:
            normalizedNote,

          performedBy:
            adminUid,

          createdAt:
            FieldValue.serverTimestamp(),
        }
      );

      return {
        placeId:
          normalizedPlaceId,

        previousStatus,

        moderationStatus:
          normalizedAction,

        moderationSource:
          "manual",

        validReportsCount,

        note:
          normalizedNote,
      };
    }
  );

  return result;
}