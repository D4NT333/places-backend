import { db, FieldValue, auth } from "../../config/firebase.js";

export default async function createOrUpdateUserService({ decodedToken }) {
  const uid = decodedToken.uid;

  // Consultamos Auth directamente para traer el estado real del usuario
  const userRecord = await auth.getUser(uid);

  const email = userRecord.email || decodedToken.email || "";

const authName = String(
  userRecord.displayName || decodedToken.name || ""
).trim();

const provider =
  userRecord.providerData?.[0]?.providerId ||
  decodedToken.firebase?.sign_in_provider ||
  "unknown";

const photoURL =
  userRecord.photoURL ||
  decodedToken.picture ||
  null;

  const emailVerified =
    provider === "password"
      ? Boolean(userRecord.emailVerified)
      : true;

  const status =
    provider === "password" && !emailVerified
      ? "pending_email_verification"
      : "active";

  const userRef = db.collection("user").doc(uid);
  const userSnap = await userRef.get();

  const now = FieldValue.serverTimestamp();

const existingUser = userSnap.exists ? userSnap.data() : {};
const existingName = String(existingUser.name || "").trim();

const finalName = existingName || authName;

const userData = {
  uid,
  photoURL,
  provider,
  emailVerified,
  status,
  lastLoginAt: now,
  updatedAt: now,
};

if (finalName) {
  userData.name = finalName;
}

  if (!userSnap.exists) {
    await userRef.set({
      ...userData,
      createdAt: now,
    });

    return {
      ...userData,
      isNewUser: true,
    };
  }

  await userRef.set(userData, { merge: true });

  return {
    ...userData,
    isNewUser: false,
  };
}