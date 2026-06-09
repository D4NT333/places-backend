import { db } from "../../../../config/firebase.js";

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return null;
  }

  return timestamp.toDate().toISOString();
}

function normalizeRejectionReason(rejectionReason = {}) {
  return {
    reason:
      rejectionReason.reason ||
      rejectionReason.rejectionReason ||
      "other",

    message:
      rejectionReason.message ||
      rejectionReason.rejectionComment ||
      "No se encontró el motivo de rechazo.",
  };
}

export default async function getMyRejectedPlaceSubmissionReasonService({
  submissionId,
  userId,
}) {
  if (!submissionId) {
    const error = new Error("Falta submissionId.");
    error.statusCode = 400;
    throw error;
  }

  if (!userId) {
    const error = new Error("Usuario no autenticado.");
    error.statusCode = 401;
    throw error;
  }

  const submissionSnap = await db
    .collection("placeSubmissions")
    .doc(submissionId)
    .get();

  if (!submissionSnap.exists) {
    const error = new Error("La propuesta no existe.");
    error.statusCode = 404;
    throw error;
  }

  const submission = submissionSnap.data();

  if (submission.createdBy !== userId) {
    const error = new Error("No tienes permiso para ver esta propuesta.");
    error.statusCode = 403;
    throw error;
  }

  if (submission.status !== "rejected") {
    const error = new Error("Esta propuesta no está rechazada.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedReason = normalizeRejectionReason(
    submission.rejectionReason || {}
  );

  return {
    submissionId,
    status: submission.status,

    reason: normalizedReason.reason,
    message: normalizedReason.message,

    rejectedAt: formatTimestamp(submission.rejectedAt),
    rejectedBy: submission.rejectedBy || null,
  };
}