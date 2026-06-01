import { auth, db, FieldValue } from "../../config/firebase.js";

import anonymizeApprovedPlacesByUserService from "./anonymizeApprovedPlacesByUser.service.js";
import deleteUserFirestoreDataService from "./deleteUserFirestoreData.service.js";
import deleteUserStorageDataService from "./deleteUserStorageData.service.js";

export default async function deleteMyAccountService({ uid }) {
  const userRef = db.collection("user").doc(uid);

  await userRef.set(
    {
      deletionStatus: "processing",
      deletionRequestedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const deleted = {
    placesAnonymized: null,
    firestore: null,
    storage: null,
    auth: false,
  };

  deleted.placesAnonymized = await anonymizeApprovedPlacesByUserService({ uid });

  deleted.firestore = await deleteUserFirestoreDataService({ uid });

  deleted.storage = await deleteUserStorageDataService({ uid });

  await auth.deleteUser(uid);
  deleted.auth = true;

  return { deleted };
}