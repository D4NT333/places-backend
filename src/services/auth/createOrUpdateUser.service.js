import { db, FieldValue } from "../../config/firebase.js";

export default async function createOrUpdateUserService({ decodedToken }) {
  const uid = decodedToken.uid;
  const email = decodedToken.email || "";
  const name = decodedToken.name || "";
  const photoURL = decodedToken.picture || "";
  const provider = decodedToken.firebase?.sign_in_provider || "unknown";

  const userRef = db.collection("user").doc(uid);
  const userSnap = await userRef.get();

  const userData = {
    uid,
    email,
    name,
    photoURL,
    provider,
    lastLoginAt: FieldValue.serverTimestamp(),
  };

  if (!userSnap.exists) {
    await userRef.set({
      ...userData,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      ...userData,
      isNewUser: true,
    };
  }

  await userRef.update(userData);

  return {
    ...userData,
    isNewUser: false,
  };
}