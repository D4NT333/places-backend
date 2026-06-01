import { db } from "../../config/firebase.js";

const BATCH_LIMIT = 450;

async function deleteQuerySnapshotInBatches(query) {
  let totalDeleted = 0;

  while (true) {
    const snapshot = await query.limit(BATCH_LIMIT).get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    totalDeleted += snapshot.size;

    if (snapshot.size < BATCH_LIMIT) {
      break;
    }
  }

  return totalDeleted;
}

async function deleteCollectionByField({
  collectionName,
  field,
  operator = "==",
  value,
}) {
  const query = db.collection(collectionName).where(field, operator, value);
  return deleteQuerySnapshotInBatches(query);
}

async function deleteUserSubcollection({ uid, subcollectionName }) {
  const query = db.collection("user").doc(uid).collection(subcollectionName);
  return deleteQuerySnapshotInBatches(query);
}

export default async function deleteUserFirestoreDataService({ uid }) {
  const deleted = {
    userDocument: false,

    placeSubmissionsByCreatedBy: 0,
    placeSubmissionsByUserId: 0,

    returnedSubmissionsByCreatedBy: 0,
    returnedSubmissionsByUserId: 0,

    favorites: 0,
    savedPlaces: 0,
    comments: 0,
    reports: 0,
    ratings: 0,
    notifications: 0,

    userSubcollections: {},
  };

  deleted.placeSubmissionsByCreatedBy = await deleteCollectionByField({
    collectionName: "placeSubmissions",
    field: "createdBy",
    value: uid,
  });

  deleted.placeSubmissionsByUserId = await deleteCollectionByField({
    collectionName: "placeSubmissions",
    field: "userId",
    value: uid,
  });

  deleted.returnedSubmissionsByCreatedBy = await deleteCollectionByField({
    collectionName: "returnedPlaceSubmissions",
    field: "createdBy",
    value: uid,
  });

  deleted.returnedSubmissionsByUserId = await deleteCollectionByField({
    collectionName: "returnedPlaceSubmissions",
    field: "userId",
    value: uid,
  });

  deleted.favorites = await deleteCollectionByField({
    collectionName: "favorites",
    field: "userId",
    value: uid,
  });

  deleted.savedPlaces = await deleteCollectionByField({
    collectionName: "savedPlaces",
    field: "userId",
    value: uid,
  });

  deleted.comments = await deleteCollectionByField({
    collectionName: "comments",
    field: "userId",
    value: uid,
  });

  deleted.reports = await deleteCollectionByField({
    collectionName: "reports",
    field: "userId",
    value: uid,
  });

  deleted.ratings = await deleteCollectionByField({
    collectionName: "ratings",
    field: "userId",
    value: uid,
  });

  deleted.notifications = await deleteCollectionByField({
    collectionName: "notifications",
    field: "userId",
    value: uid,
  });

  const userSubcollections = [
    "favorites",
    "savedPlaces",
    "notifications",
    "metrics",
    "reports",
    "comments",
    "ratings",
  ];

  for (const subcollectionName of userSubcollections) {
    deleted.userSubcollections[subcollectionName] =
      await deleteUserSubcollection({
        uid,
        subcollectionName,
      });
  }

  await db.collection("user").doc(uid).delete();
  deleted.userDocument = true;

  return deleted;
}