import { db } from "../../../../config/firebase.js";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

const REJECTION_REASON_LABELS = {
  spam: "SPAM",

  guidelines:
    "No cumple lineamientos",

  offensive_content:
    "Contenido ofensivo",

  incorrect_information:
    "Información incorrecta",

  other:
    "Otro motivo",
};

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

function timestampToISOString(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate === "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function normalizeRejectionReason(value) {
  /*
   * Estructura actual:
   *
   * rejectionReason: {
   *   reason: "...",
   *   message: "..."
   * }
   */
  if (
    value &&
    typeof value === "object"
  ) {
    const reason =
      cleanString(value.reason) ||
      cleanString(value.id);

    const message =
      cleanString(value.message) ||
      cleanString(value.comment);

    return {
      reason,

      reasonLabel:
        REJECTION_REASON_LABELS[
          reason
        ] ||
        "Motivo de rechazo",

      message,
    };
  }

  /*
   * Compatibilidad por si alguna propuesta
   * antigua guardó solamente un string.
   */
  if (
    typeof value === "string"
  ) {
    return {
      reason: "",

      reasonLabel:
        "Motivo de rechazo",

      message:
        cleanString(value),
    };
  }

  return {
    reason: "",

    reasonLabel:
      "Motivo de rechazo",

    message: "",
  };
}

export default async function getMyPhotoSubmissionRejectionReasonService({
  submissionId,
  userId,
}) {
  const normalizedSubmissionId =
    cleanString(submissionId);

  const normalizedUserId =
    cleanString(userId);

  if (!normalizedUserId) {
    throw createServiceError(
      "No se encontró un usuario autenticado.",
      401
    );
  }

  if (!normalizedSubmissionId) {
    throw createServiceError(
      "Falta el identificador de la propuesta.",
      400
    );
  }

  const submissionReference = db
    .collection(
      PHOTO_SUBMISSIONS_COLLECTION
    )
    .doc(normalizedSubmissionId);

  const submissionSnapshot =
    await submissionReference.get();

  if (!submissionSnapshot.exists) {
    throw createServiceError(
      "No se encontró la propuesta de fotografías.",
      404
    );
  }

  const submissionData =
    submissionSnapshot.data() || {};

  /*
   * No revelamos propuestas que pertenezcan
   * a otros usuarios.
   */
  if (
    cleanString(
      submissionData.createdBy
    ) !== normalizedUserId
  ) {
    throw createServiceError(
      "No se encontró la propuesta de fotografías.",
      404
    );
  }

  const status =
    cleanString(
      submissionData.status
    );

  if (status !== "rejected") {
    throw createServiceError(
      "La propuesta no se encuentra rechazada.",
      409
    );
  }

  const rejectionReason =
    normalizeRejectionReason(
      submissionData.rejectionReason
    );

  return {
    submissionId:
      cleanString(
        submissionData.submissionId
      ) ||
      submissionSnapshot.id,

    status,

    reason:
      rejectionReason.reason,

    reasonLabel:
      rejectionReason.reasonLabel,

    message:
      rejectionReason.message ||
      "No se especificó una explicación para el rechazo.",

    rejectedAt:
      timestampToISOString(
        submissionData.rejectedAt
      ),
  };
}