import admin from "firebase-admin";

import { db } from "../../config/firebase.js";

export async function createUserNotificationService({
  uid,
  type,
  title,
  body,
  data = {},
}) {
  if (!uid) {
    const error = new Error("No se recibió uid para crear notificación.");
    error.statusCode = 400;
    throw error;
  }

  const notificationRef = db
    .collection("users")
    .doc(uid)
    .collection("notifications")
    .doc();

  const notification = {
    type,
    title,
    body,
    data,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await notificationRef.set(notification);

  return {
    id: notificationRef.id,
    ...notification,
  };
}