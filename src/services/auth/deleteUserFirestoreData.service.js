import {
  db,
} from "../../config/firebase.js";

const BATCH_LIMIT = 450;

async function deleteQuerySnapshotInBatches(
  query,
) {
  let totalDeleted = 0;

  while (true) {
    const snapshot = await query
      .limit(BATCH_LIMIT)
      .get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();

    snapshot.docs.forEach(
      (document) => {
        batch.delete(
          document.ref,
        );
      },
    );

    await batch.commit();

    totalDeleted +=
      snapshot.size;

    if (
      snapshot.size <
      BATCH_LIMIT
    ) {
      break;
    }
  }

  return totalDeleted;
}

async function deleteCollectionByField({
  collectionName,
  field,
  value,
}) {
  return deleteQuerySnapshotInBatches(
    db
      .collection(
        collectionName,
      )
      .where(
        field,
        "==",
        value,
      ),
  );
}

async function deleteUserDocumentsFromCollection({
  collectionName,
  uid,
  fields,
}) {
  const deletedByField = {};
  let totalDeleted = 0;

  for (const field of fields) {
    const count =
      await deleteCollectionByField({
        collectionName,
        field,
        value: uid,
      });

    deletedByField[field] =
      count;

    totalDeleted += count;
  }

  return {
    totalDeleted,
    deletedByField,
  };
}

async function deleteUserDocumentRecursively({
  uid,
}) {
  if (
    typeof db.recursiveDelete !==
    "function"
  ) {
    throw new Error(
      "La versión actual de Firestore Admin no soporta recursiveDelete. Se detuvo el borrado para evitar subcolecciones huérfanas.",
    );
  }

  const userRef = db
    .collection("user")
    .doc(uid);

  await db.recursiveDelete(
    userRef,
  );

  return {
    deleted: true,
    method: "recursiveDelete",
  };
}

export default async function deleteUserFirestoreDataService({
  uid,
}) {
  if (
    typeof uid !== "string" ||
    !uid.trim()
  ) {
    throw new Error(
      "Se requiere un uid válido para borrar los datos del usuario.",
    );
  }

  const normalizedUid =
    uid.trim();

  const deleted = {
    submissions: {
      placeSubmissions: null,
      photoSubmissions: null,
      descriptionSubmissions: null,
      placeSubmissionReturns: null,
    },

    interactions: {
      placeReviews: null,
      comments: null,
      favorites: null,
      savedPlaces: null,
      ratings: null,
      likes: null,
    },

    accountData: {
      notifications: null,
      reports: null,
      deviceTokens: null,
    },

    userDocument: null,
  };

  deleted.submissions.placeSubmissions =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "placeSubmissions",

      uid: normalizedUid,

      fields: [
        "createdBy",
        "userId",
        "submittedBy",
        "uid",
      ],
    });

  deleted.submissions.photoSubmissions =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "photoSubmissions",

      uid: normalizedUid,

      fields: [
        "createdBy",
        "userId",
        "submittedBy",
        "uid",
      ],
    });

  deleted.submissions.descriptionSubmissions =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "descriptionSubmissions",

      uid: normalizedUid,

      fields: [
        "createdBy",
        "userId",
        "submittedBy",
        "uid",
      ],
    });

  deleted.submissions.placeSubmissionReturns =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "placeSubmissionReturns",

      uid: normalizedUid,

      fields: [
        "createdBy",
        "userId",
        "submittedBy",
        "uid",
      ],
    });

  deleted.interactions.placeReviews =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "placeReviews",

      uid: normalizedUid,

      fields: [
        "userId",
        "createdBy",
        "authorId",
        "reviewerId",
        "uid",
      ],
    });

  deleted.interactions.comments =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "comments",

      uid: normalizedUid,

      fields: [
        "userId",
        "createdBy",
        "authorId",
        "uid",
      ],
    });

  deleted.interactions.favorites =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "favorites",

      uid: normalizedUid,

      fields: [
        "userId",
        "createdBy",
        "uid",
      ],
    });

  deleted.interactions.savedPlaces =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "savedPlaces",

      uid: normalizedUid,

      fields: [
        "userId",
        "createdBy",
        "uid",
      ],
    });

  deleted.interactions.ratings =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "ratings",

      uid: normalizedUid,

      fields: [
        "userId",
        "createdBy",
        "authorId",
        "uid",
      ],
    });

  deleted.interactions.likes =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "likes",

      uid: normalizedUid,

      fields: [
        "userId",
        "createdBy",
        "uid",
      ],
    });

  deleted.accountData.notifications =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "notifications",

      uid: normalizedUid,

      fields: [
        "userId",
        "recipientId",
        "createdBy",
        "uid",
      ],
    });

  deleted.accountData.reports =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "reports",

      uid: normalizedUid,

      fields: [
        "userId",
        "createdBy",
        "reporterId",
        "reportedBy",

        /*
         * También elimina reportes donde el usuario
         * aparezca como objetivo, cuando esos campos
         * existan en la colección.
         */
        "reportedUserId",
        "targetUserId",

        "uid",
      ],
    });

  deleted.accountData.deviceTokens =
    await deleteUserDocumentsFromCollection({
      collectionName:
        "deviceTokens",

      uid: normalizedUid,

      fields: [
        "userId",
        "uid",
      ],
    });

  deleted.userDocument =
    await deleteUserDocumentRecursively({
      uid: normalizedUid,
    });

  return deleted;
}