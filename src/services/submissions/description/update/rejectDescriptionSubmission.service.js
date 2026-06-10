import { db, FieldValue } from "../../../../config/firebase.js";

const DESCRIPTION_SUBMISSIONS_COLLECTION = "descriptionSubmissions";

export default async function rejectDescriptionSubmissionService({
  submissionId,
  payload,
  rejectedBy = null,
}) {
  if (!submissionId) {
    const error = new Error("Falta submissionId para rechazar la propuesta.");
    error.statusCode = 400;
    throw error;
  }

  const reason = String(
    payload?.rejectionReason || payload?.reason || ""
  ).trim();

  const message = String(
    payload?.rejectionComment || payload?.message || ""
  ).trim();

  if (!reason) {
    const error = new Error("Selecciona una razón de rechazo.");
    error.statusCode = 400;
    throw error;
  }

  if (message.length < 10) {
    const error = new Error(
      "El motivo de rechazo debe tener al menos 10 caracteres."
    );
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

  if (submissionData.status === "accepted" || submissionData.status === "approved") {
    const error = new Error(
      "No puedes rechazar una propuesta de descripción aprobada."
    );
    error.statusCode = 400;
    throw error;
  }

  if (submissionData.status === "rejected") {
    const error = new Error(
      "Esta propuesta de descripción ya fue rechazada."
    );
    error.statusCode = 400;
    throw error;
  }

  const rejectionReason = {
    reason,
    message,
    rejectedBy,
    rejectedAt: FieldValue.serverTimestamp(),
  };

  await submissionRef.update({
    status: "rejected",

    rejectionReason,
    rejectionComment: message,

    rejectedAt: FieldValue.serverTimestamp(),
    rejectedBy,

    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: rejectedBy,

    updatedAt: FieldValue.serverTimestamp(),

    reviewHistory: FieldValue.arrayUnion({
      type: "rejected",
      reason,
      message,
      rejectedBy,
      createdAt: new Date().toISOString(),
    }),
  });

  return {
    submissionId,
    status: "rejected",
    rejectionReason: {
      reason,
      message,
      rejectedBy,
    },
  };
}