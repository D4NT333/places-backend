import { db } from "../../../../config/firebase.js";

const DESCRIPTION_SUBMISSIONS_COLLECTION = "descriptionSubmissions";

function normalizeFirestoreDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

export default async function getDescriptionSubmissionRejectionReasonService({
  submissionId,
  userId = null,
}) {
  if (!submissionId) {
    const error = new Error("Falta submissionId para consultar el motivo.");
    error.statusCode = 400;
    throw error;
  }

  const submissionRef = db
    .collection(DESCRIPTION_SUBMISSIONS_COLLECTION)
    .doc(submissionId);

  const submissionSnap = await submissionRef.get();

  if (!submissionSnap.exists) {
    const error = new Error("La propuesta de descripción no existe.");
    error.statusCode = 404;
    throw error;
  }

  const submissionData = submissionSnap.data();

  /**
   * Seguridad:
   * Si este endpoint lo consume el usuario móvil, valida que sea dueño.
   * Ajusta createdBy.uid según cómo guardes tu documento.
   */
  const ownerId =
    submissionData.createdBy?.uid ||
    submissionData.createdBy?.userId ||
    submissionData.userId ||
    submissionData.createdById ||
    null;

  if (userId && ownerId && ownerId !== userId) {
    const error = new Error("No tienes permiso para consultar esta propuesta.");
    error.statusCode = 403;
    throw error;
  }

  if (submissionData.status !== "rejected") {
    const error = new Error("Esta propuesta no ha sido rechazada.");
    error.statusCode = 400;
    throw error;
  }

  /**
   * Soporta varias formas por si guardaste:
   * rejectionReason: { reason, message, rejectedAt }
   * rejectionReason: "incorrect_information"
   * rejectionComment: "texto..."
   * reviewMessage: "texto..."
   */
  const rejectionReasonData = submissionData.rejectionReason || {};

  const reason =
    typeof rejectionReasonData === "string"
      ? rejectionReasonData
      : rejectionReasonData.reason ||
        submissionData.reason ||
        submissionData.rejectionReasonCode ||
        "other";

  const message =
    rejectionReasonData.message ||
    submissionData.rejectionComment ||
    submissionData.reviewMessage ||
    "La propuesta fue rechazada, pero no se encontró un mensaje específico.";

  const rejectedAt =
    normalizeFirestoreDate(rejectionReasonData.rejectedAt) ||
    normalizeFirestoreDate(submissionData.rejectedAt) ||
    normalizeFirestoreDate(submissionData.reviewedAt);

  return {
    submissionId,
    status: submissionData.status,
    reason,
    message,
    rejectedAt,
  };
}