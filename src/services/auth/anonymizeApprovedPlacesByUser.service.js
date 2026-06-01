import { db, FieldValue } from "../../config/firebase.js";

const BATCH_LIMIT = 450;

async function anonymizePlacesQuery(query) {
  let totalUpdated = 0;

  while (true) {
    const snapshot = await query.limit(BATCH_LIMIT).get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        createdBy: null,
        createdByUid: null,
        userId: null,
        creatorDeleted: true,
        creatorDeletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    totalUpdated += snapshot.size;

    if (snapshot.size < BATCH_LIMIT) {
      break;
    }
  }

  return totalUpdated;
}

export default async function anonymizeApprovedPlacesByUserService({ uid }) {
  let totalUpdated = 0;

  totalUpdated += await anonymizePlacesQuery(
    db.collection("places").where("createdBy", "==", uid)
  );

  totalUpdated += await anonymizePlacesQuery(
    db.collection("places").where("createdByUid", "==", uid)
  );

  totalUpdated += await anonymizePlacesQuery(
    db.collection("places").where("userId", "==", uid)
  );

  return {
    totalUpdated,
  };
}