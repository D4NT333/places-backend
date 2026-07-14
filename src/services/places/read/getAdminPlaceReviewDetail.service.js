import { db } from "../../../config/firebase.js";

import {
  serializeDate,
} from "../../../utils/firestorePagination.js";

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

function normalizeAnswer(answer = {}) {
  return {
    questionId:
      cleanText(answer.questionId) || null,

    questionText:
      cleanText(answer.questionText),

    value:
      Number.isFinite(Number(answer.value))
        ? Number(answer.value)
        : 0,

    label:
      cleanText(answer.label) || null,
  };
}

function normalizeReviewDetail(snapshot) {
  const review = snapshot.data() || {};

  return {
    reviewId:
      review.reviewId || snapshot.id,

    place: {
      placeId:
        cleanText(review.placeId) || null,

      placeName:
        cleanText(review.placeName) ||
        "Lugar sin nombre",
    },

    user: {
      uid:
        cleanText(review.userId) || null,

      name:
        cleanText(review.userName) ||
        "Usuario",

      photoURL:
        cleanText(review.userPhoto) || null,
    },

    category: {
      id:
        cleanText(review.tagId) || null,

      label:
        cleanText(review.tagLabel) ||
        "Sin categoría",
    },

    rating:
      Number.isFinite(Number(review.rating))
        ? Number(review.rating)
        : 0,

    recommended:
      typeof review.recommended === "boolean"
        ? review.recommended
        : null,

    hasDetails:
      typeof review.hasDetails === "boolean"
        ? review.hasDetails
        : false,

    matchesAnnouncement:
      typeof review.matchesAnnouncement === "boolean"
        ? review.matchesAnnouncement
        : null,

    commentText:
      cleanText(review.commentText),

    answers:
      Array.isArray(review.answers)
        ? review.answers.map(normalizeAnswer)
        : [],

    status:
      cleanText(review.status) ||
      "published",

    reportCount:
      Number.isFinite(Number(review.reportCount))
        ? Number(review.reportCount)
        : 0,

    moderation: {
      hiddenAt: serializeDate(
        review.moderation?.hiddenAt,
      ),

      hiddenBy:
        cleanText(
          review.moderation?.hiddenBy,
        ) || null,

      hiddenReason:
        cleanText(
          review.moderation?.hiddenReason ||
          review.moderation?.reason,
        ),

      restoredAt: serializeDate(
        review.moderation?.restoredAt,
      ),

      restoredBy:
        cleanText(
          review.moderation?.restoredBy,
        ) || null,
    },

    createdAt: serializeDate(
      review.createdAt,
    ),

    updatedAt: serializeDate(
      review.updatedAt,
    ),

    deletedAt: serializeDate(
      review.deletedAt,
    ),
  };
}

export default async function getAdminPlaceReviewDetailService({
  placeId,
  reviewId,
}) {
  const cleanPlaceId = cleanText(placeId);
  const cleanReviewId = cleanText(reviewId);

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

  const reviewSnapshot = await db
    .collection("placeReviews")
    .doc(cleanReviewId)
    .get();

  if (!reviewSnapshot.exists) {
    throw createHttpError(
      "No se encontró la reseña solicitada.",
      404,
    );
  }

  const review = reviewSnapshot.data();

  if (cleanText(review.placeId) !== cleanPlaceId) {
    throw createHttpError(
      "La reseña no pertenece al lugar indicado.",
      409,
    );
  }

  return {
    review: normalizeReviewDetail(
      reviewSnapshot,
    ),
  };
}