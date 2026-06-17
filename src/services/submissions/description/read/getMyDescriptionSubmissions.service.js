import { db } from "../../../../config/firebase.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;

const VISIBLE_STATUSES = [
  "in_review",
  "approved",
  "rejected",
];

const STATUS_LABELS = {
  in_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeTimestamp(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function normalizeLimit(value) {
  const parsedLimit = Number(value);

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsedLimit, MAX_LIMIT);
}

function buildGooglePhotoUrl(reference) {
  if (!reference) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) return null;

  return `https://places.googleapis.com/v1/${reference}/media?maxWidthPx=400&key=${apiKey}`;
}

function getMainPhotoUrl(submissionData) {
  const placeSnapshot =
    submissionData.placeSnapshot || {};

  const mainPhoto =
    placeSnapshot.mainPhoto ||
    submissionData.mainPhoto ||
    null;

  if (!mainPhoto) return null;

  if (typeof mainPhoto === "string") {
    return mainPhoto;
  }

  if (mainPhoto.url) {
    return mainPhoto.url;
  }

  if (mainPhoto.medium?.url) {
    return mainPhoto.medium.url;
  }

  if (mainPhoto.thumbnail?.url) {
    return mainPhoto.thumbnail.url;
  }

  if (mainPhoto.downloadURL) {
    return mainPhoto.downloadURL;
  }

  if (
    mainPhoto.source === "google" &&
    mainPhoto.reference
  ) {
    return buildGooglePhotoUrl(
      mainPhoto.reference
    );
  }

  if (mainPhoto.reference) {
    return buildGooglePhotoUrl(
      mainPhoto.reference
    );
  }

  return null;
}

function getPreviewText(value = "") {
  const text = String(value).trim();

  if (text.length <= 85) {
    return text;
  }

  return `${text.slice(0, 85)}...`;
}

function normalizeSubmission(doc) {
  const data = doc.data();

  const status =
    data.status ||
    "in_review";

  return {
    id: doc.id,

    submissionId:
      data.submissionId ||
      doc.id,

    type:
      data.type ||
      "description",

    status,

    statusLabel:
      STATUS_LABELS[status] ||
      status,

    placeId:
      data.placeId ||
      data.placeDocId ||
      null,

    placeDocId:
      data.placeDocId ||
      data.placeId ||
      null,

    placeName:
      data.placeName ||
      data.placeSnapshot?.name ||
      "Lugar sin nombre",

    proposedDescription:
      data.proposedDescription ||
      "",

    descriptionPreview:
      getPreviewText(
        data.proposedDescription ||
        ""
      ),

    currentDescription:
      data.currentDescription ||
      "",

    imageUrl:
      getMainPhotoUrl(data),

    createdAt:
      normalizeTimestamp(
        data.createdAt
      ),

    updatedAt:
      normalizeTimestamp(
        data.updatedAt
      ),

    reviewedAt:
      normalizeTimestamp(
        data.reviewedAt
      ),

    reviewMessage:
      data.reviewMessage ||
      null,

    canDelete:
      status === "approved" ||
      status === "rejected",
  };
}

async function getMyDescriptionSubmissionsService({
  userId,
  limit,
}) {
  if (!userId) {
    throw createHttpError(
      401,
      "Usuario no autenticado."
    );
  }

  const safeLimit =
    normalizeLimit(limit);

  const snapshot = await db
    .collection(
      "descriptionSubmissions"
    )
    .where(
      "createdBy.uid",
      "==",
      userId
    )
    .where(
      "type",
      "==",
      "description"
    )
    .where(
      "deletedAt",
      "==",
      null
    )
    .where(
      "status",
      "in",
      VISIBLE_STATUSES
    )
    .orderBy(
      "createdAt",
      "desc"
    )
    .limit(
      safeLimit
    )
    .get();

  const submissions =
    snapshot.docs.map(
      normalizeSubmission
    );

  return {
    submissions,
    count: submissions.length,
  };
}

export default getMyDescriptionSubmissionsService;