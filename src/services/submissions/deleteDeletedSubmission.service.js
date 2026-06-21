import { db } from "../../config/firebase.js";
import admin from "firebase-admin";

const DELETED_SUBMISSIONS_COLLECTION =
  "deletedSubmissions";

const PENDING_DELETE_STATUS =
  "pending_delete";

const APPROVED_STATUS =
  "approved";

const SUBMISSION_COLLECTIONS = {
  place: "placeSubmissions",
  photo: "photoSubmissions",
  description: "descriptionSubmissions",
};

const RETURN_COLLECTIONS = {
  place: "placeSubmissionReturns",
  photo: "photoSubmissionReturns",
  description: "descriptionSubmissionReturns",
};

function createServiceError(
  message,
  statusCode
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getExpectedSourceCollection(type) {
  return SUBMISSION_COLLECTIONS[type] || "";
}

function getReturnCollection(type) {
  return RETURN_COLLECTIONS[type] || "";
}

function getCreatedByUid(submission) {
  const createdBy =
    submission?.createdBy;

  if (typeof createdBy === "string") {
    return cleanString(createdBy);
  }

  if (
    createdBy &&
    typeof createdBy === "object"
  ) {
    return (
      cleanString(createdBy.uid) ||
      cleanString(createdBy.userId)
    );
  }

  return (
    cleanString(submission?.userId) ||
    cleanString(submission?.createdById)
  );
}

function getSubmissionPublicId(
  deletedSubmission,
  submission,
  fallbackId
) {
  return (
    cleanString(
      deletedSubmission?.submissionId
    ) ||
    cleanString(
      submission?.submissionId
    ) ||
    cleanString(
      submission?.placeSubmissionId
    ) ||
    cleanString(
      submission?.photoSubmissionId
    ) ||
    fallbackId
  );
}

function getPlaceId(
  deletedSubmission,
  submission
) {
  return (
    cleanString(
      deletedSubmission?.placeId
    ) ||
    cleanString(submission?.placeId)
  );
}

function getStoragePrefix({
  type,
  deletedSubmission,
  submission,
  submissionPublicId,
}) {
  const userId =
    cleanString(deletedSubmission?.userId) ||
    getCreatedByUid(submission);

  if (!userId || !submissionPublicId) {
    return "";
  }

  if (type === "place") {
    return `submissions/${userId}/placeSubmissions/${submissionPublicId}`;
  }

  if (type === "photo") {
    const placeId =
      getPlaceId(
        deletedSubmission,
        submission
      );

    if (!placeId) {
      return "";
    }

    return `submissions/${userId}/photoSubmissions/${placeId}/${submissionPublicId}`;
  }

  return "";
}

async function deleteStorageFolder(prefix) {
  if (!prefix) {
    return {
      deleted: false,
      reason: "missing_prefix",
    };
  }

  const bucket =
    admin.storage().bucket();

  await bucket.deleteFiles({
    prefix,
    force: true,
  });

  return {
    deleted: true,
    prefix,
  };
}

async function getReturnDocuments({
  type,
  submissionDocId,
  submissionPublicId,
}) {
  const returnCollection =
    getReturnCollection(type);

  if (!returnCollection) {
    return [];
  }

  const collectionRef =
    db.collection(returnCollection);

  const docsMap = new Map();

  const directDoc =
    await collectionRef
      .doc(submissionDocId)
      .get();

  if (directDoc.exists) {
    docsMap.set(
      directDoc.ref.path,
      directDoc.ref
    );
  }

  if (
    submissionPublicId &&
    submissionPublicId !==
      submissionDocId
  ) {
    const publicDoc =
      await collectionRef
        .doc(submissionPublicId)
        .get();

    if (publicDoc.exists) {
      docsMap.set(
        publicDoc.ref.path,
        publicDoc.ref
      );
    }
  }

  const bySubmissionDocId =
    await collectionRef
      .where(
        "submissionDocId",
        "==",
        submissionDocId
      )
      .get();

  bySubmissionDocId.docs.forEach(
    (doc) => {
      docsMap.set(
        doc.ref.path,
        doc.ref
      );
    }
  );

  if (submissionPublicId) {
    const bySubmissionId =
      await collectionRef
        .where(
          "submissionId",
          "==",
          submissionPublicId
        )
        .get();

    bySubmissionId.docs.forEach(
      (doc) => {
        docsMap.set(
          doc.ref.path,
          doc.ref
        );
      }
    );
  }

  return Array.from(docsMap.values());
}

async function deleteDocumentsBatch(refs) {
  if (!refs.length) {
    return 0;
  }

  const batch =
    db.batch();

  refs.forEach((ref) => {
    batch.delete(ref);
  });

  await batch.commit();

  return refs.length;
}

export default async function deleteDeletedSubmissionService({
  deletedSubmissionId,
}) {
  if (!deletedSubmissionId) {
    throw createServiceError(
      "Falta el id de la propuesta eliminada.",
      400
    );
  }

  const deletedSubmissionRef =
    db
      .collection(
        DELETED_SUBMISSIONS_COLLECTION
      )
      .doc(deletedSubmissionId);

  const deletedSubmissionSnap =
    await deletedSubmissionRef.get();

  if (!deletedSubmissionSnap.exists) {
    throw createServiceError(
      "La propuesta eliminada no existe.",
      404
    );
  }

  const deletedSubmission =
    deletedSubmissionSnap.data() || {};

  if (
    cleanString(
      deletedSubmission.status
    ) !== PENDING_DELETE_STATUS
  ) {
    throw createServiceError(
      "Esta propuesta no está pendiente de eliminación definitiva.",
      409
    );
  }

  const type =
    cleanString(deletedSubmission.type);

  const expectedSourceCollection =
    getExpectedSourceCollection(type);

  if (!expectedSourceCollection) {
    throw createServiceError(
      "Tipo de propuesta inválido.",
      400
    );
  }

  const sourceCollection =
    cleanString(
      deletedSubmission.sourceCollection
    ) || expectedSourceCollection;

  if (
    sourceCollection !==
    expectedSourceCollection
  ) {
    throw createServiceError(
      "La colección de origen no coincide con el tipo de propuesta.",
      409
    );
  }

  const submissionDocId =
    cleanString(
      deletedSubmission.submissionDocId
    ) ||
    cleanString(
      deletedSubmission.submissionId
    );

  if (!submissionDocId) {
    throw createServiceError(
      "No se encontró el documento original de la propuesta.",
      409
    );
  }

  const submissionRef =
    db
      .collection(sourceCollection)
      .doc(submissionDocId);

  const submissionSnap =
    await submissionRef.get();

  const submission =
    submissionSnap.exists
      ? submissionSnap.data() || {}
      : {};

  const submissionPublicId =
    getSubmissionPublicId(
      deletedSubmission,
      submission,
      submissionDocId
    );

  const previousStatus =
    cleanString(
      deletedSubmission.previousStatus
    ) ||
    cleanString(
      submission.previousStatus
    );

  const wasApproved =
    previousStatus === APPROVED_STATUS;

  const shouldDeleteStorage =
    type !== "description" &&
    !wasApproved;

  const storagePrefix =
    shouldDeleteStorage
      ? getStoragePrefix({
          type,
          deletedSubmission,
          submission,
          submissionPublicId,
        })
      : "";

  const returnRefs =
    await getReturnDocuments({
      type,
      submissionDocId,
      submissionPublicId,
    });

  const refsToDelete = [
    ...returnRefs,
    deletedSubmissionRef,
  ];

  if (submissionSnap.exists) {
    refsToDelete.push(submissionRef);
  }

  const deletedDocumentsCount =
    await deleteDocumentsBatch(
      refsToDelete
    );

  const storageResult =
    shouldDeleteStorage
      ? await deleteStorageFolder(
          storagePrefix
        )
      : {
          deleted: false,
          reason: wasApproved
            ? "approved_submission_storage_preserved"
            : "description_has_no_submission_storage",
        };

  return {
    deleted: true,

    deletedSubmissionId,
    type,

    submissionDocId,
    submissionId: submissionPublicId,

    previousStatus,

    wasApproved,

    deletedDocumentsCount,

    storage: storageResult,
  };
}