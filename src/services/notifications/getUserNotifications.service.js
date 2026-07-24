import { db } from "../../config/firebase.js";

const USERS_COLLECTION = "user";
const NOTIFICATIONS_COLLECTION = "notifications";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeLimit(value) {
  const parsedLimit = Number(value);

  if (!Number.isInteger(parsedLimit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(parsedLimit, 1),
    MAX_LIMIT,
  );
}

function serializeTimestamp(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function normalizeNotification(documentSnapshot) {
  const notification =
    documentSnapshot.data() || {};

  return {
    id: documentSnapshot.id,

    type:
      typeof notification.type === "string"
        ? notification.type
        : "unknown",

    title:
      typeof notification.title === "string"
        ? notification.title
        : "Notificación",

    body:
      typeof notification.body === "string"
        ? notification.body
        : "",

    data:
      notification.data &&
      typeof notification.data === "object"
        ? notification.data
        : {},

    read: notification.read === true,

    createdAt: serializeTimestamp(
      notification.createdAt,
    ),
  };
}

export async function getUserNotificationsService({
  uid,
  limit,
}) {
  if (typeof uid !== "string" || !uid.trim()) {
    throw createServiceError(
      "Usuario no autenticado.",
      401,
    );
  }

  const normalizedLimit = normalizeLimit(limit);

  const snapshot = await db
    .collection(USERS_COLLECTION)
    .doc(uid.trim())
    .collection(NOTIFICATIONS_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(normalizedLimit)
    .get();

  const notifications =
    snapshot.docs.map(normalizeNotification);

  return {
    ok: true,
    notifications,
    count: notifications.length,
  };
}