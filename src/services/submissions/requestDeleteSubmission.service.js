import { db } from "../../config/firebase.js";
import admin from "firebase-admin";

const PENDING_DELETE_STATUS =
  "pending_delete";

const DELETED_SUBMISSIONS_COLLECTION =
  "deletedSubmissions";

const USERS_COLLECTION =
  "user";

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
  "approved",
];

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

function getCollectionName(type) {
  const collectionName =
    SUBMISSION_COLLECTIONS[type];

  if (!collectionName) {
    throw createServiceError(
      "Tipo de propuesta inválido.",
      400
    );
  }

  return collectionName;
}

function getCreatedByUid(submission) {
  const createdBy =
    submission?.createdBy;

  if (
    typeof createdBy === "string"
  ) {
    return createdBy;
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

  return "";
}

function getCreatedByName(
  submission
) {
  const createdBy =
    submission?.createdBy;

  return (
    cleanString(
      submission?.createdByName
    ) ||
    cleanString(
      submission?.userName
    ) ||
    cleanString(createdBy?.name) ||
    cleanString(
      createdBy?.displayName
    ) ||
    "Usuario"
  );
}

function getUserName(
  userData,
  submission
) {
  return (
    cleanString(userData?.name) ||
    cleanString(
      userData?.displayName
    ) ||
    cleanString(
      userData?.userName
    ) ||
    getCreatedByName(submission)
  );
}

function getUserPhotoURL(
  userData,
  submission
) {
  return (
    cleanString(
      userData?.photoURL
    ) ||
    cleanString(
      userData?.photoUrl
    ) ||
    cleanString(
      userData?.picture
    ) ||
    cleanString(
      userData?.avatarUrl
    ) ||
    cleanString(
      submission?.createdByPhotoURL
    ) ||
    cleanString(
      submission?.userPhotoURL
    ) ||
    null
  );
}

function getSubmissionPublicId(
  submission,
  fallbackId
) {
  return (
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

function getSubmissionTitle(
  type,
  submission
) {
  if (type === "place") {
    return (
      cleanString(submission?.name) ||
      cleanString(
        submission?.placeName
      ) ||
      "Lugar sin nombre"
    );
  }

  if (type === "photo") {
    const count =
      Number(
        submission?.photoCount
      ) || 0;

    const placeName =
      cleanString(
        submission?.placeName
      ) ||
      "lugar sin nombre";

    return count > 0
      ? `${count} fotos de ${placeName}`
      : `Fotos de ${placeName}`;
  }

  if (type === "description") {
    const placeName =
      cleanString(
        submission?.placeName
      ) ||
      "lugar sin nombre";

    return `Descripción de ${placeName}`;
  }

  return "Propuesta";
}

function getSubmissionPreviewImage(
  type,
  submission
) {
  if (type === "place") {
    const firstPhoto =
      Array.isArray(
        submission?.photos
      )
        ? submission.photos[0]
        : null;

    return (
      cleanString(
        firstPhoto?.medium?.url
      ) ||
      cleanString(
        firstPhoto?.mediumUrl
      ) ||
      cleanString(
        firstPhoto?.thumbnail?.url
      ) ||
      cleanString(
        firstPhoto?.thumbnailUrl
      ) ||
      cleanString(
        submission?.thumbnailUrl
      ) ||
      cleanString(
        submission?.imageUrl
      ) ||
      null
    );
  }

  if (type === "photo") {
    const firstPhoto =
      Array.isArray(
        submission?.photos
      )
        ? submission.photos[0]
        : null;

    return (
      cleanString(
        submission?.thumbnailUrl
      ) ||
      cleanString(
        firstPhoto?.thumbnail?.url
      ) ||
      cleanString(
        firstPhoto?.thumbnailUrl
      ) ||
      cleanString(
        firstPhoto?.medium?.url
      ) ||
      cleanString(
        firstPhoto?.mediumUrl
      ) ||
      null
    );
  }

  if (type === "description") {
    return (
      cleanString(
        submission?.imageUrl
      ) ||
      cleanString(
        submission?.placeSnapshot
          ?.mainPhoto?.url
      ) ||
      cleanString(
        submission?.placeSnapshot
          ?.mainPhoto?.medium?.url
      ) ||
      cleanString(
        submission?.placeSnapshot
          ?.mainPhoto?.mediumUrl
      ) ||
      null
    );
  }

  return null;
}

function buildDeletedSubmissionId(
  type,
  submissionPublicId
) {
  return `${type}_${submissionPublicId}`;
}

export default async function requestDeleteSubmissionService({
  type,
  submissionId,
  userId,
}) {
  if (!userId) {
    throw createServiceError(
      "Usuario no autenticado.",
      401
    );
  }

  if (!submissionId) {
    throw createServiceError(
      "Falta el id de la propuesta.",
      400
    );
  }

  const collectionName =
    getCollectionName(type);

  const submissionRef = db
    .collection(collectionName)
    .doc(submissionId);

  const userRef = db
    .collection(USERS_COLLECTION)
    .doc(userId);

  return db.runTransaction(
    async (transaction) => {
      /*
       * Firestore exige hacer todas las lecturas
       * antes de comenzar con escrituras.
       */
      const [
        submissionSnap,
        userSnap,
      ] = await Promise.all([
        transaction.get(
          submissionRef
        ),

        transaction.get(userRef),
      ]);

      if (!submissionSnap.exists) {
        throw createServiceError(
          "La propuesta no existe.",
          404
        );
      }

      const submission =
        submissionSnap.data() || {};

      const userData =
        userSnap.exists
          ? userSnap.data() || {}
          : {};

      const createdByUid =
        getCreatedByUid(submission);

      if (createdByUid !== userId) {
        throw createServiceError(
          "No puedes eliminar una propuesta que no es tuya.",
          403
        );
      }

      const submissionPublicId =
        getSubmissionPublicId(
          submission,
          submissionId
        );

      const deletedSubmissionId =
        buildDeletedSubmissionId(
          type,
          submissionPublicId
        );

      const deletedSubmissionRef =
        db
          .collection(
            DELETED_SUBMISSIONS_COLLECTION
          )
          .doc(
            deletedSubmissionId
          );

      const userName =
        getUserName(
          userData,
          submission
        );

      const userPhotoURL =
        getUserPhotoURL(
          userData,
          submission
        );

      const title =
        getSubmissionTitle(
          type,
          submission
        );

      const previewImageUrl =
        getSubmissionPreviewImage(
          type,
          submission
        );

      if (
        submission.status ===
        PENDING_DELETE_STATUS
      ) {
        const now =
          admin.firestore.FieldValue
            .serverTimestamp();

        transaction.set(
          deletedSubmissionRef,
          {
            type,

            sourceCollection:
              collectionName,

            submissionDocId:
              submissionId,

            submissionId:
              submissionPublicId,

            title,
            previewImageUrl,

            userId,
            userName,
            userPhotoURL,

            status:
              PENDING_DELETE_STATUS,

            requestedAt: now,
            updatedAt: now,

            alreadyRequested: true,
          },
          {
            merge: true,
          }
        );

        return {
          type,
          submissionId:
            submissionPublicId,
          deletedSubmissionId,
          status:
            PENDING_DELETE_STATUS,
          alreadyRequested: true,
        };
      }

      if (
        !ALLOWED_STATUSES.includes(
          submission.status
        )
      ) {
        throw createServiceError(
          "Esta propuesta no se puede enviar a eliminación.",
          409
        );
      }

      const previousStatus =
        cleanString(
          submission.status
        ) || null;

      const now =
        admin.firestore.FieldValue
          .serverTimestamp();

      transaction.update(
        submissionRef,
        {
          status:
            PENDING_DELETE_STATUS,

          deleteRequestedAt: now,
          deleteRequestedBy:
            userId,

          deletedByUser: true,

          previousStatus,

          updatedAt: now,
        }
      );

      transaction.set(
        deletedSubmissionRef,
        {
          type,

          sourceCollection:
            collectionName,

          submissionDocId:
            submissionId,

          submissionId:
            submissionPublicId,

          title,
          previewImageUrl,

          userId,
          userName,
          userPhotoURL,

          status:
            PENDING_DELETE_STATUS,

          previousStatus,

          requestedAt: now,
          updatedAt: now,

          alreadyRequested: false,
        },
        {
          merge: true,
        }
      );

      return {
        type,

        submissionId:
          submissionPublicId,

        deletedSubmissionId,

        status:
          PENDING_DELETE_STATUS,

        alreadyRequested: false,
      };
    }
  );
}