import { db } from "../../config/firebase.js";
import admin from "firebase-admin";

const PENDING_DELETE_STATUS = "pending_delete";
const DELETED_SUBMISSIONS_COLLECTION = "deletedSubmissions";

const SUBMISSION_COLLECTIONS = {
  place: "placeSubmissions",
  photo: "photoSubmissions",
  description: "descriptionSubmissions",
};

const ALLOWED_STATUSES = [
  "in_review",
  "pending",
  "returned",
  "resubmitted",
  "rejected",
];

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function getCollectionName(type) {
  const collectionName = SUBMISSION_COLLECTIONS[type];

  if (!collectionName) {
    throw createServiceError("Tipo de propuesta inválido.", 400);
  }

  return collectionName;
}

function getCreatedByUid(submission) {
  const createdBy = submission?.createdBy;

  if (typeof createdBy === "string") {
    return createdBy;
  }

  if (createdBy && typeof createdBy === "object") {
    return createdBy.uid || "";
  }

  return "";
}

function getCreatedByName(submission) {
  const createdBy = submission?.createdBy;

  return (
    submission?.createdByName ||
    submission?.userName ||
    createdBy?.name ||
    createdBy?.displayName ||
    "Usuario"
  );
}

function getSubmissionPublicId(submission, fallbackId) {
  return (
    submission?.submissionId ||
    submission?.placeSubmissionId ||
    submission?.photoSubmissionId ||
    fallbackId
  );
}

function getSubmissionTitle(type, submission) {
  if (type === "place") {
    return (
      submission?.name ||
      submission?.placeName ||
      "Lugar sin nombre"
    );
  }

  if (type === "photo") {
    const count = Number(submission?.photoCount) || 0;
    const placeName =
      submission?.placeName ||
      "lugar sin nombre";

    return count > 0
      ? `${count} fotos de ${placeName}`
      : `Fotos de ${placeName}`;
  }

  if (type === "description") {
    return (
      `Descripción de ${
        submission?.placeName ||
        "lugar sin nombre"
      }`
    );
  }

  return "Propuesta";
}

function getSubmissionPreviewImage(type, submission) {
  if (type === "place") {
    const firstPhoto = Array.isArray(submission?.photos)
      ? submission.photos[0]
      : null;

    return (
      firstPhoto?.medium?.url ||
      firstPhoto?.mediumUrl ||
      firstPhoto?.thumbnail?.url ||
      firstPhoto?.thumbnailUrl ||
      submission?.thumbnailUrl ||
      null
    );
  }

  if (type === "photo") {
    return (
      submission?.thumbnailUrl ||
      submission?.photos?.[0]?.thumbnail?.url ||
      submission?.photos?.[0]?.medium?.url ||
      null
    );
  }

  if (type === "description") {
    return (
      submission?.imageUrl ||
      submission?.placeSnapshot?.mainPhoto?.url ||
      submission?.placeSnapshot?.mainPhoto?.medium?.url ||
      null
    );
  }

  return null;
}

function buildDeletedSubmissionId(type, submissionPublicId) {
  return `${type}_${submissionPublicId}`;
}

export default async function requestDeleteSubmissionService({
  type,
  submissionId,
  userId,
}) {
  if (!userId) {
    throw createServiceError("Usuario no autenticado.", 401);
  }

  if (!submissionId) {
    throw createServiceError("Falta el id de la propuesta.", 400);
  }

  const collectionName = getCollectionName(type);

  const submissionRef = db
    .collection(collectionName)
    .doc(submissionId);

  return db.runTransaction(async (transaction) => {
    const submissionSnap = await transaction.get(submissionRef);

    if (!submissionSnap.exists) {
      throw createServiceError("La propuesta no existe.", 404);
    }

    const submission = submissionSnap.data();

    const createdByUid = getCreatedByUid(submission);

    if (createdByUid !== userId) {
      throw createServiceError(
        "No puedes eliminar una propuesta que no es tuya.",
        403
      );
    }

    const submissionPublicId = getSubmissionPublicId(
      submission,
      submissionId
    );

    const deletedSubmissionId = buildDeletedSubmissionId(
      type,
      submissionPublicId
    );

    const deletedSubmissionRef = db
      .collection(DELETED_SUBMISSIONS_COLLECTION)
      .doc(deletedSubmissionId);

    if (submission.status === PENDING_DELETE_STATUS) {
      transaction.set(
        deletedSubmissionRef,
        {
          type,
          sourceCollection: collectionName,
          submissionDocId: submissionId,
          submissionId: submissionPublicId,

          title: getSubmissionTitle(type, submission),
          previewImageUrl: getSubmissionPreviewImage(type, submission),

          userId,
          userName: getCreatedByName(submission),

          status: PENDING_DELETE_STATUS,
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),

          alreadyRequested: true,
        },
        { merge: true }
      );

      return {
        type,
        submissionId: submissionPublicId,
        deletedSubmissionId,
        status: PENDING_DELETE_STATUS,
        alreadyRequested: true,
      };
    }

    if (!ALLOWED_STATUSES.includes(submission.status)) {
      throw createServiceError(
        "Esta propuesta no se puede enviar a eliminación.",
        409
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    transaction.update(submissionRef, {
      status: PENDING_DELETE_STATUS,

      deleteRequestedAt: now,
      deleteRequestedBy: userId,
      deletedByUser: true,

      previousStatus: submission.status || null,
      updatedAt: now,
    });

    transaction.set(
      deletedSubmissionRef,
      {
        type,
        sourceCollection: collectionName,
        submissionDocId: submissionId,
        submissionId: submissionPublicId,

        title: getSubmissionTitle(type, submission),
        previewImageUrl: getSubmissionPreviewImage(type, submission),

        userId,
        userName: getCreatedByName(submission),

        status: PENDING_DELETE_STATUS,
        previousStatus: submission.status || null,

        requestedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return {
      type,
      submissionId: submissionPublicId,
      deletedSubmissionId,
      status: PENDING_DELETE_STATUS,
      alreadyRequested: false,
    };
  });
}