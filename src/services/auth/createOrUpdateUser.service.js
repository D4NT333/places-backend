import {
  db,
  FieldValue,
  auth,
} from "../../config/firebase.js";

function createInitialModerationData() {
  return {
    warningCount: 0,

    lastWarningAt: null,
    lastWarningReason: null,

    bannedAt: null,
    bannedBy: null,
    banReason: null,
  };
}

export default async function createOrUpdateUserService({
  decodedToken,
}) {
  const uid = decodedToken.uid;

  /*
   * Consultamos Firebase Authentication para obtener
   * la información real y actualizada del usuario.
   */
  const userRecord = await auth.getUser(uid);

  const authName = String(
    userRecord.displayName ||
      decodedToken.name ||
      "",
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

  const userRef = db
    .collection("user")
    .doc(uid);

  const userSnap = await userRef.get();

  const now = FieldValue.serverTimestamp();

  const existingUser = userSnap.exists
    ? userSnap.data()
    : {};

    const existingStatus =
  typeof existingUser.status === "string"
    ? existingUser.status
    : "active";

const nextStatus =
  existingStatus === "pending_email_verification" &&
  emailVerified
    ? "active"
    : existingStatus;

  const existingName = String(
    existingUser.name || "",
  ).trim();

  /*
   * Si el usuario ya eligió o guardó un nombre,
   * conservamos ese nombre.
   *
   * Si todavía no tiene uno, usamos el de Firebase Auth.
   */
  const finalName =
    existingName ||
    authName;

  /*
   * Estos campos sí pueden actualizarse
   * cada vez que inicia sesión.
   *
   * Deliberadamente no incluimos:
   *
   * - status
   * - moderation
   * - createdAt
   *
   * Así no destruimos una advertencia o bloqueo.
   */
  const sessionData = {
  uid,
  photoURL,
  provider,
  emailVerified,

  status: nextStatus,

  lastLoginAt: now,
  updatedAt: now,
};

  if (finalName) {
    sessionData.name = finalName;
  }

  /*
   * Si no existe, significa que es la primera
   * sincronización del usuario.
   */
  if (!userSnap.exists) {
    /*
     * Google entra directamente como active.
     *
     * Dejamos la condición de password como protección,
     * aunque normalmente el registro manual se crea desde
     * registerEmailUserController.
     */
    const initialStatus =
      provider === "password" && !emailVerified
        ? "pending_email_verification"
        : "active";

    const newUserData = {
      ...sessionData,

      status: initialStatus,

      moderation: createInitialModerationData(),

      createdAt: now,
    };

    await userRef.set(newUserData);

    return {
      ...newUserData,
      isNewUser: true,
    };
  }

  /*
   * Usuario existente:
   * actualizamos solamente información de sesión.
   *
   * status se conserva exactamente como estaba.
   */
  await userRef.set(
    sessionData,
    {
      merge: true,
    },
  );

  return {
  ...sessionData,

  status: nextStatus,

  moderation:
    existingUser.moderation ||
    createInitialModerationData(),

  isNewUser: false,
};
}