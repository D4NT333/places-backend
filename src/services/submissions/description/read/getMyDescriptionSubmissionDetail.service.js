import { db } from "../../../../config/firebase.js";

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

const STATUS_LABELS = {
  in_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

function buildGooglePhotoUrl(reference) {
  if (!reference) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) return null;

  return `https://places.googleapis.com/v1/${reference}/media?maxWidthPx=600&key=${apiKey}`;
}

function getMainPhotoUrl(data) {
  const placeSnapshot = data.placeSnapshot || {};
  const mainPhoto = placeSnapshot.mainPhoto || data.mainPhoto || null;

  if (!mainPhoto) return null;

  if (typeof mainPhoto === "string") {
    return mainPhoto;
  }

  if (mainPhoto.url) {
    return mainPhoto.url;
  }

  if (mainPhoto.downloadURL) {
    return mainPhoto.downloadURL;
  }

  if (mainPhoto.reference) {
    return buildGooglePhotoUrl(mainPhoto.reference);
  }

  return null;
}

async function getMyDescriptionSubmissionDetailService({
  userId,
  submissionId,
}) {
  if (!userId) {
    throw createHttpError(401, "Usuario no autenticado.");
  }

  if (!submissionId) {
    throw createHttpError(400, "El id de la propuesta es obligatorio.");
  }

  const submissionSnap = await db
    .collection("descriptionSubmissions")
    .doc(submissionId)
    .get();

  if (!submissionSnap.exists) {
    throw createHttpError(404, "No se encontró la propuesta de descripción.");
  }

  const data = submissionSnap.data();

  if (data.deletedAt) {
    throw createHttpError(
      404,
      "La propuesta de descripción ya no está disponible."
    );
  }

  if (data.createdBy?.uid !== userId) {
    throw createHttpError(
      403,
      "No tienes permiso para ver esta propuesta de descripción."
    );
  }

  const status = data.status || "in_review";
  const placeSnapshot = data.placeSnapshot || {};

  return {
    id: submissionSnap.id,
    submissionId: data.submissionId || submissionSnap.id,

    type: data.type || "description",
    status,
    statusLabel: STATUS_LABELS[status] || status,

    placeId: data.placeId || data.placeDocId || null,
    placeDocId: data.placeDocId || data.placeId || null,

    placeName:
      data.placeName ||
      placeSnapshot.name ||
      "Lugar sin nombre",

    submittedAt: normalizeTimestamp(data.createdAt),
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),

    reviewedAt: normalizeTimestamp(data.reviewedAt),
    reviewMessage: data.reviewMessage || null,

    currentDescription: data.currentDescription || "",
    proposedDescription: data.proposedDescription || "",

    imageUrl: getMainPhotoUrl(data),

    placeSnapshot: {
      name:
        placeSnapshot.name ||
        data.placeName ||
        "Lugar sin nombre",
      address: placeSnapshot.address || null,
      mainPhoto: placeSnapshot.mainPhoto || null,
    },

    canDelete: status === "approved" || status === "rejected",
    canEdit: status === "rejected",
  };
}

export default getMyDescriptionSubmissionDetailService;