import { db, FieldValue } from "../../../../config/firebase.js";

export default async function rejectPlaceSubmissionService({
  submissionId,
  payload,
  rejectedBy = null,
}) {
  if (!submissionId) {
    throw new Error("Falta submissionId para rechazar la propuesta.");
  }

  const message = String(payload?.message || "").trim();
  const reason = String(payload?.reason || "").trim();

  if (message.length < 10) {
    const error = new Error("El motivo de rechazo debe tener al menos 10 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (!reason) {
    const error = new Error("Selecciona una razón de rechazo.");
    error.statusCode = 400;
    throw error;
  }

  const submissionRef = db.collection("placeSubmissions").doc(submissionId);
  const submissionSnap = await submissionRef.get();

  if (!submissionSnap.exists) {
    const error = new Error("La propuesta no existe.");
    error.statusCode = 404;
    throw error;
  }

  const submissionData = submissionSnap.data();

  if (submissionData.status === "approved") {
    const error = new Error("No puedes rechazar una propuesta aprobada.");
    error.statusCode = 400;
    throw error;
  }

  const rejectionData = {
    reason,
    message,
    rejectedBy,
    rejectedAt: FieldValue.serverTimestamp(),
  };

  await submissionRef.update({
    status: "rejected",
    rejectionReason: rejectionData,
    rejectedAt: FieldValue.serverTimestamp(),
    rejectedBy,
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