import { db } from "../../config/firebase.js";

const DELETED_SUBMISSIONS_COLLECTION =
  "deletedSubmissions";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;

function createServiceError(
  message,
  statusCode
) {
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
    MAX_LIMIT
  );
}

function timestampToISOString(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate === "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return date.toISOString();
}

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeDeletedSubmission(
  documentSnapshot
) {
  const data =
    documentSnapshot.data() || {};

  const submissionId =
    cleanString(data.submissionId) ||
    cleanString(
      data.submissionDocId
    );

  return {
    id: documentSnapshot.id,

    submissionId,

    submissionDocId:
      cleanString(
        data.submissionDocId
      ) || submissionId,

    sourceCollection:
      cleanString(
        data.sourceCollection
      ),

    type:
      cleanString(data.type),

    title:
      cleanString(data.title) ||
      "Propuesta eliminada",

    status:
      cleanString(data.status) ||
      "pending_delete",

    previousStatus:
      cleanString(
        data.previousStatus
      ),

    userId:
      cleanString(data.userId),

    userName:
      cleanString(data.userName) ||
      "Usuario",

    userPhotoURL:
      cleanString(
        data.userPhotoURL
      ) || null,

    previewImageUrl:
      cleanString(
        data.previewImageUrl
      ) || null,

    requestedAt:
      timestampToISOString(
        data.requestedAt
      ),

    updatedAt:
      timestampToISOString(
        data.updatedAt
      ),
  };
}

export default async function getDeletedSubmissionsService({
  limit,
  cursor,
} = {}) {
  const normalizedLimit =
    normalizeLimit(limit);

  let query = db
    .collection(
      DELETED_SUBMISSIONS_COLLECTION
    )
    .where(
      "status",
      "==",
      "pending_delete"
    )
    .orderBy(
      "requestedAt",
      "desc"
    )
    .limit(
      normalizedLimit + 1
    );

  if (cursor) {
    const cursorDocument =
      await db
        .collection(
          DELETED_SUBMISSIONS_COLLECTION
        )
        .doc(cursor)
        .get();

    if (!cursorDocument.exists) {
      throw createServiceError(
        "El cursor proporcionado no es válido.",
        400
      );
    }

    query = query.startAfter(
      cursorDocument
    );
  }

  const snapshot =
    await query.get();

  const documents =
    snapshot.docs;

  const hasMore =
    documents.length >
    normalizedLimit;

  const visibleDocuments =
    hasMore
      ? documents.slice(
          0,
          normalizedLimit
        )
      : documents;

  const items =
    visibleDocuments.map(
      normalizeDeletedSubmission
    );

  const lastDocument =
    visibleDocuments[
      visibleDocuments.length - 1
    ];

  return {
    items,

    pagination: {
      limit: normalizedLimit,

      hasMore,

      nextCursor:
        hasMore && lastDocument
          ? lastDocument.id
          : null,
    },
  };
}