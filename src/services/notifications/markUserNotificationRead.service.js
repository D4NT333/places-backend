import { db } from "../../config/firebase.js";

const USERS_COLLECTION = "user";
const NOTIFICATIONS_COLLECTION = "notifications";

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function markUserNotificationReadService({
  uid,
  notificationId,
}) {
  if (typeof uid !== "string" || !uid.trim()) {
    throw createServiceError(
      "Usuario no autenticado.",
      401,
    );
  }

  if (
    typeof notificationId !== "string" ||
    !notificationId.trim()
  ) {
    throw createServiceError(
      "Falta el identificador de la notificación.",
      400,
    );
  }

  const notificationRef = db
    .collection(USERS_COLLECTION)
    .doc(uid.trim())
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(notificationId.trim());

  const notificationSnapshot =
    await notificationRef.get();

  if (!notificationSnapshot.exists) {
    throw createServiceError(
      "La notificación no existe.",
      404,
    );
  }

  await notificationRef.update({
    read: true,
  });

  return {
    ok: true,
    notificationId: notificationRef.id,
    read: true,
  };
}