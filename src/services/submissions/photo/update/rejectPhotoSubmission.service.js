import { db } from "../../../../config/firebase.js";

import {
  createUserNotificationService,
} from "../../../notifications/createUserNotification.service.js";

import {
  sendPushNotificationToUserService,
} from "../../../notifications/sendPushNotificationToUser.service.js";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

const VALID_REJECTION_REASONS = [
  "spam",
  "guidelines",
  "offensive_content",
  "incorrect_information",
  "other",
];

const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 300;

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getUserUid(submissionData = {}) {
  return (
    cleanString(submissionData.createdBy?.uid) ||
    cleanString(submissionData.createdBy) ||
    cleanString(submissionData.uid) ||
    cleanString(submissionData.submittedBy?.uid) ||
    cleanString(submissionData.submittedBy) ||
    cleanString(submissionData.userId) ||
    null
  );
}

function createServiceError(
  message,
  statusCode
) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
}

export default async function rejectPhotoSubmissionService({
  submissionId,
  rejectedBy,
  reason,
  message,
}) {
  const normalizedSubmissionId =
    cleanString(submissionId);

  const normalizedRejectedBy =
    cleanString(rejectedBy);

  const normalizedReason =
    cleanString(reason);

  const normalizedMessage =
    cleanString(message);

  if (!normalizedRejectedBy) {
    throw createServiceError(
      "No se encontró un administrador autenticado.",
      401
    );
  }

  if (!normalizedSubmissionId) {
    throw createServiceError(
      "Falta el identificador de la propuesta.",
      400
    );
  }

  if (
    !VALID_REJECTION_REASONS.includes(
      normalizedReason
    )
  ) {
    throw createServiceError(
      "El motivo de rechazo no es válido.",
      400
    );
  }

  if (
    normalizedMessage.length <
    MIN_MESSAGE_LENGTH
  ) {
    throw createServiceError(
      `La explicación debe contener al menos ${MIN_MESSAGE_LENGTH} caracteres.`,
      400
    );
  }

  if (
    normalizedMessage.length >
    MAX_MESSAGE_LENGTH
  ) {
    throw createServiceError(
      `La explicación no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.`,
      400
    );
  }

  const submissionReference = db
    .collection(
      PHOTO_SUBMISSIONS_COLLECTION
    )
    .doc(normalizedSubmissionId);

  const result = await db.runTransaction(
    async (transaction) => {
      const submissionSnapshot =
        await transaction.get(
          submissionReference
        );

      if (!submissionSnapshot.exists) {
        throw createServiceError(
          "No se encontró la propuesta de fotografías.",
          404
        );
      }

      const submissionData =
        submissionSnapshot.data() || {};

      const currentStatus =
        cleanString(
          submissionData.status
        );

      if (
        currentStatus !== "in_review"
      ) {
        throw createServiceError(
          "La propuesta ya fue revisada y no puede rechazarse nuevamente.",
          409
        );
      }

      const rejectedAt =
        new Date();

      const rejectionReason = {
        reason:
          normalizedReason,

        message:
          normalizedMessage,
      };

      transaction.update(
        submissionReference,
        {
          status: "rejected",

          rejectionReason,

          rejectedAt,

          rejectedBy:
            normalizedRejectedBy,

          updatedAt:
            rejectedAt,
        }
      );

      return {
  id: submissionSnapshot.id,

  submissionId:
    cleanString(
      submissionData.submissionId
    ) ||
    submissionSnapshot.id,

  placeId:
    cleanString(
      submissionData.placeId
    ),

  placeName:
    cleanString(
      submissionData.placeName
    ) ||
    "Lugar sin nombre",

  createdBy:
    getUserUid(submissionData),

  status:
    "rejected",

  rejectionReason,

  rejectedAt:
    rejectedAt.toISOString(),

  rejectedBy:
    normalizedRejectedBy,
};

    }
  );

  const notificationData = {
  screen: "VisualizedAddedPhotosScreen",
  type: "photo_submission_rejected",
  submissionId: result.submissionId,
  placeId: result.placeId,
};

if (result.createdBy) {
  const title = "Tus fotografías fueron rechazadas";

  const body =
    `Tu propuesta de fotografías para “${result.placeName}” fue rechazada. Revisa el motivo.`;

  try {
    const notification =
      await createUserNotificationService({
        uid: result.createdBy,
        type: "photo_submission_rejected",
        title,
        body,
        data: notificationData,
      });

    const pushResult =
      await sendPushNotificationToUserService({
        uid: result.createdBy,
        title,
        body,
        data: {
          ...notificationData,
          notificationId: notification.id,
        },
      });

    console.log(
      "Notificación de fotografías rechazadas enviada:",
      {
        submissionId: result.submissionId,
        uid: result.createdBy,
        sent: pushResult.sent,
      },
    );
  } catch (notificationError) {
    console.error(
      "Las fotografías fueron rechazadas, pero falló la notificación:",
      notificationError,
    );
  }
}

return result;
}