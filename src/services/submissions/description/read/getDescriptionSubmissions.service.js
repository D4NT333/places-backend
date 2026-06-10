import { db } from "../../../../config/firebase.js";

const DESCRIPTION_SUBMISSIONS_COLLECTION = "descriptionSubmissions";

const VALID_STATUSES = ["in_review", "accepted", "rejected"];

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function buildPhotoUrl(baseUrl, mainPhoto) {
  const reference = cleanText(mainPhoto?.reference);

  if (!reference) return null;

  return `${baseUrl}/api/places/photos/google?reference=${encodeURIComponent(
    reference
  )}`;
}

function normalizeStatusLabel(status) {
  const cleanStatus = cleanText(status);

  const labels = {
    in_review: "Pendiente",
    accepted: "Aceptada",
    rejected: "Rechazada",
  };

  return labels[cleanStatus] || cleanStatus || "Pendiente";
}

function normalizeSubmissionDoc(doc, baseUrl) {
  const submission = doc.data();

  const status = cleanText(submission.status) || "in_review";
  const mainPhoto = submission.placeSnapshot?.mainPhoto || null;

  return {
    id: doc.id,
    submissionId: cleanText(submission.submissionId) || doc.id,

    type: cleanText(submission.type) || "description",
    status,
    statusLabel: normalizeStatusLabel(status),

    placeId: cleanText(submission.placeId),
    placeDocId: cleanText(submission.placeDocId),
    placeName:
      cleanText(submission.placeName) ||
      cleanText(submission.placeSnapshot?.name) ||
      "Lugar sin nombre",

    currentDescription: cleanText(submission.currentDescription),
    proposedDescription: cleanText(submission.proposedDescription),

    preview: cleanText(submission.proposedDescription),

    placeSnapshot: {
      name: cleanText(submission.placeSnapshot?.name),
      address: cleanText(submission.placeSnapshot?.address),
      mainPhoto,
      mainPhotoUrl: buildPhotoUrl(baseUrl, mainPhoto),
      tagId: cleanText(submission.placeSnapshot?.tagId),
      tagLabel: cleanText(submission.placeSnapshot?.tagLabel),
      subtags: Array.isArray(submission.placeSnapshot?.subtags)
        ? submission.placeSnapshot.subtags
        : [],
      approaches: Array.isArray(submission.placeSnapshot?.approaches)
        ? submission.placeSnapshot.approaches
        : [],
    },

    createdBy: {
      uid: cleanText(submission.createdBy?.uid),
      email: cleanText(submission.createdBy?.email),
      name: cleanText(submission.createdBy?.name) || "Usuario",
      picture: cleanText(submission.createdBy?.picture) || null,
    },

    reviewedBy: submission.reviewedBy || null,
    reviewedAt: normalizeTimestamp(submission.reviewedAt),
    reviewMessage: cleanText(submission.reviewMessage),

    createdAt: normalizeTimestamp(submission.createdAt),
    updatedAt: normalizeTimestamp(submission.updatedAt),
    deletedAt: normalizeTimestamp(submission.deletedAt),
  };
}

export default async function getDescriptionSubmissionsService({
  status,
  limit = 50,
  baseUrl,
}) {
  const cleanStatus = cleanText(status);

  const cleanLimit = Number(limit);
  const finalLimit =
    Number.isFinite(cleanLimit) && cleanLimit > 0 && cleanLimit <= 100
      ? cleanLimit
      : 50;

  let query = db
    .collection(DESCRIPTION_SUBMISSIONS_COLLECTION)
    .where("deletedAt", "==", null)
    .orderBy("createdAt", "desc")
    .limit(finalLimit);

  if (cleanStatus && VALID_STATUSES.includes(cleanStatus)) {
    query = db
      .collection(DESCRIPTION_SUBMISSIONS_COLLECTION)
      .where("deletedAt", "==", null)
      .where("status", "==", cleanStatus)
      .orderBy("createdAt", "desc")
      .limit(finalLimit);
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => normalizeSubmissionDoc(doc, baseUrl));
}