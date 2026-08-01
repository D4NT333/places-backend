import {
  FieldPath,
  Timestamp,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 15;

function createHttpError(
  message,
  statusCode = 400
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

function normalizeLimit(value) {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    parsed,
    MAX_LIMIT
  );
}

function serializeDate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function encodeCursor({
  createdAtMs,
  reviewId,
}) {
  const payload = JSON.stringify({
    createdAtMs,
    reviewId,
  });

  return Buffer
    .from(payload, "utf8")
    .toString("base64url");
}

function decodeCursor(cursor) {
  const cleanCursor =
    cleanText(cursor);

  if (!cleanCursor) {
    return null;
  }

  try {
    const decoded = Buffer
      .from(
        cleanCursor,
        "base64url"
      )
      .toString("utf8");

    const parsed =
      JSON.parse(decoded);

    const createdAtMs =
      Number(parsed.createdAtMs);

    const reviewId =
      cleanText(parsed.reviewId);

    if (
      !Number.isFinite(
        createdAtMs
      ) ||
      !reviewId
    ) {
      throw new Error(
        "Cursor incompleto."
      );
    }

    return {
      createdAtMs,
      reviewId,
    };
  } catch {
    throw createHttpError(
      "El cursor de paginación no es válido.",
      400
    );
  }
}

function normalizeReviewListItem(
  snapshot,
  currentUid
) {
  const review =
    snapshot.data() || {};

  const userId =
    cleanText(
      review.userId
    );

  const rating =
    Number(review.rating);

  return {
    reviewId:
      cleanText(
        review.reviewId
      ) ||
      snapshot.id,

    placeId:
      cleanText(
        review.placeId
      ),

    user: {
      uid:
        userId || null,

      name:
        cleanText(
          review.userName
        ) ||
        "Usuario",

      photoURL:
        cleanText(
          review.userPhoto
        ) ||
        null,
    },

    rating:
      Number.isFinite(rating)
        ? rating
        : 0,

    recommended:
      typeof review.recommended ===
      "boolean"
        ? review.recommended
        : null,

    hasDetails:
      Boolean(
        review.hasDetails
      ),

    commentText:
      cleanText(
        review.commentText
      ),

    createdAt:
      serializeDate(
        review.createdAt
      ),

    isCurrentUser:
      Boolean(
        currentUid &&
        userId === currentUid
      ),
  };
}

export default async function getPlaceReviewsService({
  placeId,
  uid,
  limit,
  cursor,
}) {
  const cleanPlaceId =
    cleanText(placeId);

  const cleanUid =
    cleanText(uid);

  if (!cleanPlaceId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400
    );
  }

  const pageLimit =
    normalizeLimit(limit);

  const decodedCursor =
    decodeCursor(cursor);

  let query = db
    .collection(
      "placeReviews"
    )
    .where(
      "placeId",
      "==",
      cleanPlaceId
    )
    .where(
      "status",
      "==",
      "published"
    )
    .where(
      "deletedAt",
      "==",
      null
    )
    .orderBy(
      "createdAt",
      "desc"
    )
    .orderBy(
      FieldPath.documentId(),
      "desc"
    );

  if (decodedCursor) {
    query = query.startAfter(
      Timestamp.fromMillis(
        decodedCursor.createdAtMs
      ),
      decodedCursor.reviewId
    );
  }

  /*
   * Pedimos un documento extra únicamente
   * para saber si existe otra página.
   */
  const snapshot =
    await query
      .limit(pageLimit + 1)
      .get();

  const hasMore =
    snapshot.docs.length >
    pageLimit;

  const pageDocs =
    snapshot.docs.slice(
      0,
      pageLimit
    );

  const reviews =
    pageDocs.map(
      (document) =>
        normalizeReviewListItem(
          document,
          cleanUid
        )
    );

  let nextCursor = null;

  if (
    hasMore &&
    pageDocs.length > 0
  ) {
    const lastDocument =
      pageDocs[
        pageDocs.length - 1
      ];

    const lastReview =
      lastDocument.data();

    const createdAt =
      lastReview.createdAt;

    if (
      createdAt &&
      typeof createdAt.toMillis ===
      "function"
    ) {
      nextCursor =
        encodeCursor({
          createdAtMs:
            createdAt.toMillis(),

          reviewId:
            lastDocument.id,
        });
    }
  }

  return {
    reviews,

    pagination: {
      limit:
        pageLimit,

      hasMore,

      nextCursor,
    },
  };
}