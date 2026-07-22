import { db, FieldValue } from "../../../../config/firebase.js";

import {
  createUserNotificationService,
} from "../../../notifications/createUserNotification.service.js";

import {
  sendPushNotificationToUserService,
} from "../../../notifications/sendPushNotificationToUser.service.js";

const DESCRIPTION_SUBMISSIONS_COLLECTION =
  "descriptionSubmissions";

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getUserUid(submissionData = {}) {
  return (
    cleanText(submissionData.createdBy?.uid) ||
    cleanText(submissionData.createdBy) ||
    cleanText(submissionData.uid) ||
    cleanText(submissionData.submittedBy?.uid) ||
    cleanText(submissionData.submittedBy) ||
    cleanText(submissionData.userId) ||
    null
  );
}

export default async function rejectDescriptionSubmissionService({
  submissionId,
  payload,
  rejectedBy = null,
}) {
  if (!submissionId) {
    const error = new Error(
      "Falta submissionId para rechazar la propuesta.",
    );

    error.statusCode = 400;
    throw error;
  }

  const reason = String(
    payload?.rejectionReason ||
      payload?.reason ||
      "",
  ).trim();

  const message = String(
    payload?.rejectionComment ||
      payload?.message ||
      "",
  ).trim();

  if (!reason) {
    const error = new Error(
      "Selecciona una razón de rechazo.",
    );

    error.statusCode = 400;
    throw error;
  }

  if (message.length < 10) {
    const error = new Error(
      "El motivo de rechazo debe tener al menos 10 caracteres.",
    );

    error.statusCode = 400;
    throw error;
  }

  const submissionRef = db
    .collection(
      DESCRIPTION_SUBMISSIONS_COLLECTION,
    )
    .doc(submissionId);

  const submissionSnap =
    await submissionRef.get();

  if (!submissionSnap.exists) {
    const error = new Error(
      "La propuesta de descripción no existe.",
    );

    error.statusCode = 404;
    throw error;
  }

  const submissionData =
    submissionSnap.data();

  if (
    submissionData.status === "accepted" ||
    submissionData.status === "approved"
  ) {
    const error = new Error(
      "No puedes rechazar una propuesta de descripción aprobada.",
    );

    error.statusCode = 400;
    throw error;
  }

  if (submissionData.status === "rejected") {
    const error = new Error(
      "Esta propuesta de descripción ya fue rechazada.",
    );

    error.statusCode = 400;
    throw error;
  }

  const rejectionReason = {
    reason,
    message,
    rejectedBy,
    rejectedAt:
      FieldValue.serverTimestamp(),
  };

  await submissionRef.update({
    status: "rejected",

    rejectionReason,
    rejectionComment: message,

    rejectedAt:
      FieldValue.serverTimestamp(),

    rejectedBy,

    reviewedAt:
      FieldValue.serverTimestamp(),

    reviewedBy: rejectedBy,

    updatedAt:
      FieldValue.serverTimestamp(),

    reviewHistory: FieldValue.arrayUnion({
      type: "rejected",
      reason,
      message,
      rejectedBy,
      createdAt: new Date().toISOString(),
    }),
  });

  const userId = getUserUid(submissionData);

  const placeName =
    cleanText(submissionData.placeName) ||
    cleanText(submissionData.place?.name) ||
    "el lugar";

  const notificationData = {
    screen:
      "VisualizedAddedDescriptionScreen",

    type:
      "description_submission_rejected",

    submissionId,

    placeId:
      cleanText(submissionData.placeDocId) ||
      cleanText(submissionData.placeId) ||
      null,
  };

  if (userId) {
    const title =
      "Tu descripción fue rechazada";

    const body =
      `Tu propuesta de descripción para “${placeName}” fue rechazada. Revisa el motivo.`;

    try {
      const notification =
        await createUserNotificationService({
          uid: userId,
          type:
            "description_submission_rejected",
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
            notificationId:
              notification.id,
          },
        });

      console.log(
        "Notificación de descripción rechazada enviada:",
        {
          submissionId,
          uid: userId,
          sent: pushResult.sent,
        },
      );
    } catch (notificationError) {
      console.error(
        "La descripción fue rechazada, pero falló la notificación:",
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