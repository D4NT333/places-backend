import { db } from "../../../config/firebase.js";

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return null;
  }

  return timestamp.toDate().toISOString();
}

function normalizeReturnFields(fields = {}) {
  return {
    name: fields.name || { selected: false, message: "" },
    description: fields.description || { selected: false, message: "" },
    tag: fields.tag || { selected: false, message: "" },
    subtags: fields.subtags || { selected: false, message: "" },
    approaches: fields.approaches || { selected: false, message: "" },
    price: fields.price || { selected: false, message: "" },
    schedule: fields.schedule || { selected: false, message: "" },
    photos: fields.photos || { selected: false, message: "", items: [] },
    location: fields.location || { selected: false, message: "" },
  };
}

export default async function getReturnedPlaceSubmissionReviewService(
  submissionId
) {
  if (!submissionId) {
    const error = new Error("Falta submissionId.");
    error.statusCode = 400;
    throw error;
  }

  const returnsSnap = await db
    .collection("placeSubmissionReturns")
    .where("submissionId", "==", submissionId)
    .orderBy("returnedAt", "desc")
    .limit(1)
    .get();

  if (returnsSnap.empty) {
    const error = new Error("No se encontró información de devolución.");
    error.statusCode = 404;
    throw error;
  }

  const doc = returnsSnap.docs[0];
  const data = doc.data();

  return {
    id: doc.id,
    returnId: data.returnId || doc.id,
    submissionId: data.submissionId || submissionId,

    generalMessage: data.generalMessage || "",
    returnFields: normalizeReturnFields(data.fields || data.returnFields),

    resolved: Boolean(data.resolved),
    returnedBy: data.returnedBy || null,
    returnedAt: formatTimestamp(data.returnedAt),
    resolvedAt: formatTimestamp(data.resolvedAt),

    snapshotBeforeReturn: data.snapshotBeforeReturn || null,
  };
}