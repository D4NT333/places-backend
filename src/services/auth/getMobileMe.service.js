import { auth, db } from "../../config/firebase.js";

function getMainProviderId(userRecord) {
  const providerData = userRecord.providerData || [];

  if (providerData.some((provider) => provider.providerId === "password")) {
    return "password";
  }

  if (providerData.some((provider) => provider.providerId === "google.com")) {
    return "google.com";
  }

  return providerData[0]?.providerId || "unknown";
}

export default async function getMobileMeService({ uid }) {
  const userRecord = await auth.getUser(uid);

  const userSnap = await db.collection("user").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};

  const providerId = getMainProviderId(userRecord);

  return {
    user: {
      uid,
      email: userRecord.email || userData.email || null,
      name: userData.name || userRecord.displayName || null,
      username: userData.username || null,
      photoURL: userRecord.photoURL || userData.photoURL || null,
      providerId,
      emailVerified: Boolean(userRecord.emailVerified),
      disabled: Boolean(userRecord.disabled),
      existsInFirestore: userSnap.exists,
    },
  };
}