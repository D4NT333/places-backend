import {
  FieldPath,
} from "firebase-admin/firestore";

import { db } from "../../../config/firebase.js";

import {
  decodeCursor,
  encodeCursor,
  getDateMillis,
  millisToTimestamp,
  serializeDate,
} from "../../../utils/firestorePagination.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeLimit(value) {
  const parsedLimit = Number(value);

  if (!Number.isInteger(parsedLimit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(parsedLimit, 1),
    MAX_LIMIT,
  );
}

function normalizeReview(snapshot) {
  const review = snapshot.data();

  return {
    reviewId: review.reviewId || snapshot.id,

    placeId: review.placeId || null,
    placeName: review.placeName || null,

    user: {
      uid: review.userId || null,
      name: review.userName || "Usuario",
      photoURL: review.userPhoto || null,
    },

    rating: Number(review.rating) || 0,
    commentText: review.commentText || "",

    recommended:
      typeof review.recommended === "boolean"
        ? review.recommended
        : null,

    matchesAnnouncement:
      typeof review.matchesAnnouncement === "boolean"
        ? review.matchesAnnouncement
        : null,

    hasDetails:
      typeof review.hasDetails === "boolean"
        ? review.hasDetails
        : false,

    reportCount:
      Number(review.reportCount) || 0,

    status: review.status || "published",

    category: {
      id: review.tagId || null,
      label: review.tagLabel || null,
    },

    answers: Array.isArray(review.answers)
      ? review.answers.map((answer) => ({
          questionId:
            answer.questionId || null,

          questionText:
            answer.questionText || "",

          value:
            Number(answer.value) || 0,

          label: answer.label || null,
        }))
      : [],

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

export default async function getAdminPlaceReviewsService({
  placeId,
  limit,
  cursor,
}) {
  if (!placeId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  const normalizedLimit = normalizeLimit(limit);
  const decodedCursor = decodeCursor(cursor);

  let query = db
    .collection("placeReviews")
    .where("placeId", "==", placeId)
    .where("deletedAt", "==", null)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(normalizedLimit + 1);

  if (decodedCursor) {
    if (
      !decodedCursor.createdAt ||
      !decodedCursor.id
    ) {
      throw createHttpError(
        "El cursor de reseñas no es válido.",
        400,
      );
    }

    query = query.startAfter(
      millisToTimestamp(
        decodedCursor.createdAt,
      ),
      decodedCursor.id,
    );
  }

  const snapshot = await query.get();

  const hasMore =
    snapshot.docs.length > normalizedLimit;

  const pageDocuments = hasMore
    ? snapshot.docs.slice(0, normalizedLimit)
    : snapshot.docs;

  const reviews =
    pageDocuments.map(normalizeReview);

  const lastDocument =
    pageDocuments[pageDocuments.length - 1];

  const nextCursor =
    hasMore && lastDocument
      ? encodeCursor({
          id: lastDocument.id,
          createdAt: getDateMillis(
            lastDocument.data().createdAt,
          ),
        })
      : null;

  return {
    reviews,

    pagination: {
      limit: normalizedLimit,
      nextCursor,
      hasMore,
    },
  };
}