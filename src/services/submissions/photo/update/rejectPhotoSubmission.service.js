import { db } from "../../../../config/firebase.js";

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
        id:
          submissionSnapshot.id,

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

  return result;
}