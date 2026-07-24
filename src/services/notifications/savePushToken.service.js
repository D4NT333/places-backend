import { Expo } from "expo-server-sdk";
import admin from "firebase-admin";

import { db } from "../../config/firebase.js";

const USERS_COLLECTION = "user";
const PUSH_TOKENS_COLLECTION = "pushTokens";

function encodeTokenId(token) {
  return Buffer.from(token).toString("base64url");
}

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function savePushTokenService({
  uid,
  expoPushToken,
  platform,
}) {
  const normalizedUid =
    typeof uid === "string"
      ? uid.trim()
      : "";

  if (!normalizedUid) {
    throw createServiceError(
      "Usuario no autenticado.",
      401,
    );
  }

  if (!Expo.isExpoPushToken(expoPushToken)) {
    throw createServiceError(
      "Expo push token inválido.",
      400,
    );
  }

  const tokenId = encodeTokenId(expoPushToken);

  const tokenRef = db
    .collection(USERS_COLLECTION)
    .doc(normalizedUid)
    .collection(PUSH_TOKENS_COLLECTION)
    .doc(tokenId);

  const tokenSnapshot = await tokenRef.get();

  const now =
    admin.firestore.FieldValue.serverTimestamp();

  const tokenData = {
    token: expoPushToken,
    platform: platform || "android",
    enabled: true,
    updatedAt: now,
    lastSeenAt: now,
  };

  if (!tokenSnapshot.exists) {
    tokenData.createdAt = now;
  }

  /*
   * Busca el mismo token en cualquier usuario.
   * Si pertenece a otro usuario, lo desactiva.
   */
  const existingTokensSnapshot = await db
    .collectionGroup(PUSH_TOKENS_COLLECTION)
    .where("token", "==", expoPushToken)
    .get();

  const batch = db.batch();

  existingTokensSnapshot.docs.forEach(
    (tokenDocument) => {
      const ownerUserRef =
        tokenDocument.ref.parent.parent;

      const belongsToAnotherUser =
        ownerUserRef &&
        ownerUserRef.id !== normalizedUid;

      if (belongsToAnotherUser) {
        batch.set(
          tokenDocument.ref,
          {
            enabled: false,
            updatedAt: now,
            disabledReason:
              "assigned_to_another_user",
          },
          {
            merge: true,
          },
        );
      }
    },
  );

  batch.set(
    tokenRef,
    tokenData,
    {
      merge: true,
    },
  );

  await batch.commit();

  return {
    ok: true,
    message:
      "Token de notificaciones guardado correctamente.",
  };
}