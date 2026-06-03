import { Expo } from "expo-server-sdk";
import admin from "firebase-admin";

import { db } from "../../config/firebase.js";

function encodeTokenId(token) {
  return Buffer.from(token).toString("base64url");
}

export async function savePushTokenService({ uid, expoPushToken, platform }) {
  if (!uid) {
    const error = new Error("Usuario no autenticado.");
    error.statusCode = 401;
    throw error;
  }

  if (!Expo.isExpoPushToken(expoPushToken)) {
    const error = new Error("Expo push token inválido.");
    error.statusCode = 400;
    throw error;
  }

  const tokenId = encodeTokenId(expoPushToken);

  const tokenRef = db
    .collection("users")
    .doc(uid)
    .collection("pushTokens")
    .doc(tokenId);

  const now = admin.firestore.FieldValue.serverTimestamp();

  await tokenRef.set(
    {
      token: expoPushToken,
      platform: platform || "android",
      enabled: true,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    },
    { merge: true }
  );

  return {
    ok: true,
    message: "Token de notificaciones guardado correctamente.",
  };
}