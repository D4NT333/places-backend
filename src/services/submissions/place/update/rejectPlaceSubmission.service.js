import { db, FieldValue } from "../../../../config/firebase.js";

import {
  createUserNotificationService,
} from "../../../notifications/createUserNotification.service.js";

import {
  sendPushNotificationToUserService,
} from "../../../notifications/sendPushNotificationToUser.service.js";

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

  const userId = submissionData.createdBy || null;

const placeName =
  typeof submissionData.name === "string"
    ? submissionData.name.trim()
    : "";

const notificationData = {
  screen: "VisualizedAddedPlacesScreen",
  type: "place_submission_rejected",
  submissionId,
};

if (userId) {
  const title = "Tu propuesta fue rechazada";

  const body = placeName
    ? `La propuesta de “${placeName}” fue rechazada. Revisa el motivo.`
    : "Tu propuesta de lugar fue rechazada. Revisa el motivo.";

  try {
    const notification =
      await createUserNotificationService({
        uid: userId,
        type: "place_submission_rejected",
        title,
        body,
        data: notificationData,
      });

    const pushResult =
      await sendPushNotificationToUserService({
        uid: userId,
        title,
        body,
        data: {
          ...notificationData,
          notificationId: notification.id,
        },
      });

    console.log(
      "Notificación de rechazo enviada:",
      {
        submissionId,
        uid: userId,
        sent: pushResult.sent,
      },
    );
  } catch (notificationError) {
    console.error(
      "La propuesta fue rechazada, pero falló la notificación:",
      notificationError,
    );
  }
}

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