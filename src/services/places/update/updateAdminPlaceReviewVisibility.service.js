import {
  db,
  FieldValue,
} from "../../../config/firebase.js";

const REVIEW_STATUS = {
  PUBLISHED: "published",
  HIDDEN: "hidden",
};

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 300;

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export default async function updateAdminPlaceReviewVisibilityService({
  placeId,
  reviewId,
  hidden,
  reason = "",
  adminUid,
}) {
  const cleanPlaceId = cleanText(placeId);
  const cleanReviewId = cleanText(reviewId);
  const cleanAdminUid = cleanText(adminUid);
  const cleanReason = cleanText(reason);

  if (!cleanPlaceId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  if (!cleanReviewId) {
    throw createHttpError(
      "El identificador de la reseña es obligatorio.",
      400,
    );
  }

  if (typeof hidden !== "boolean") {
    throw createHttpError(
      "El campo hidden debe ser verdadero o falso.",
      400,
    );
  }

  if (!cleanAdminUid) {
    throw createHttpError(
      "No se pudo identificar al administrador.",
      401,
    );
  }

  if (
    hidden &&
    cleanReason.length < MIN_REASON_LENGTH
  ) {
    throw createHttpError(
      `El motivo debe tener al menos ${MIN_REASON_LENGTH} caracteres.`,
      400,
    );
  }

  if (cleanReason.length > MAX_REASON_LENGTH) {
    throw createHttpError(
      `El motivo no puede superar ${MAX_REASON_LENGTH} caracteres.`,
      400,
    );
  }

  const reviewRef = db
    .collection("placeReviews")
    .doc(cleanReviewId);

  const result = await db.runTransaction(
    async (transaction) => {
      const reviewSnapshot =
        await transaction.get(reviewRef);

      if (!reviewSnapshot.exists) {
        throw createHttpError(
          "No se encontró la reseña.",
          404,
        );
      }

      const review = reviewSnapshot.data();

      if (
        cleanText(review.placeId) !==
        cleanPlaceId
      ) {
        throw createHttpError(
          "La reseña no pertenece al lugar indicado.",
          409,
        );
      }

      if (review.deletedAt) {
        throw createHttpError(
          "La reseña fue eliminada y no puede cambiar de visibilidad.",
          409,
        );
      }

      const currentStatus =
        cleanText(review.status) ||
        REVIEW_STATUS.PUBLISHED;

      const nextStatus = hidden
        ? REVIEW_STATUS.HIDDEN
        : REVIEW_STATUS.PUBLISHED;

      /*
       * Si ya tiene el estado solicitado,
       * no escribimos nuevamente.
       */
      if (currentStatus === nextStatus) {
        return {
          changed: false,
          reviewId: reviewSnapshot.id,
          placeId: cleanPlaceId,
          previousStatus: currentStatus,
          status: currentStatus,

          message: hidden
            ? "La reseña ya se encuentra oculta."
            : "La reseña ya se encuentra publicada.",
        };
      }

      if (
        currentStatus !== REVIEW_STATUS.PUBLISHED &&
        currentStatus !== REVIEW_STATUS.HIDDEN
      ) {
        throw createHttpError(
          `No se puede cambiar la visibilidad de una reseña con estado ${currentStatus}.`,
          409,
        );
      }

      const now =
        FieldValue.serverTimestamp();

      if (hidden) {
        transaction.update(reviewRef, {
          status: REVIEW_STATUS.HIDDEN,

          "moderation.hiddenAt": now,
          "moderation.hiddenBy": cleanAdminUid,
          "moderation.hiddenReason": cleanReason,

          "moderation.restoredAt": null,
          "moderation.restoredBy": null,

          updatedAt: now,
        });
      } else {
        transaction.update(reviewRef, {
          status: REVIEW_STATUS.PUBLISHED,

          /*
           * Conservamos la información de quién
           * la ocultó y el motivo como auditoría.
           */
          "moderation.restoredAt": now,
          "moderation.restoredBy": cleanAdminUid,

          updatedAt: now,
        });
      }

      return {
        changed: true,

        reviewId: reviewSnapshot.id,
        placeId: cleanPlaceId,

        previousStatus: currentStatus,
        status: nextStatus,
      };
    },
  );

  return result;
}