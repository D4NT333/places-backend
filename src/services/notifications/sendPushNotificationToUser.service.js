import { Expo } from "expo-server-sdk";

import { db } from "../../config/firebase.js";

const expo = new Expo();

export async function sendPushNotificationToUserService({
  uid,
  title,
  body,
  data = {},
}) {
  if (!uid) {
    return {
      ok: false,
      sent: 0,
      message: "No se recibió uid.",
    };
  }

  const tokensSnapshot = await db
    .collection("users")
    .doc(uid)
    .collection("pushTokens")
    .where("enabled", "==", true)
    .get();

  if (tokensSnapshot.empty) {
    return {
      ok: true,
      sent: 0,
      message: "El usuario no tiene tokens activos.",
    };
  }

  const messages = [];

  tokensSnapshot.forEach((doc) => {
    const tokenData = doc.data();

    if (!Expo.isExpoPushToken(tokenData.token)) return;

    messages.push({
      to: tokenData.token,
      sound: "default",
      title,
      body,
      data,
    });
  });

  if (messages.length === 0) {
    return {
      ok: true,
      sent: 0,
      message: "No hay tokens válidos.",
    };
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...ticketChunk);
  }

  return {
    ok: true,
    sent: messages.length,
    tickets,
  };
}