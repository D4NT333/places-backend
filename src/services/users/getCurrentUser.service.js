import { db } from "../../config/firebase.js";

const BLOCKED_USER_STATUSES = new Set([
  "blocked",
  "banned",
  "permanently_banned",
]);

function createHttpError(
  message,
  statusCode = 400,
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeStatus(value) {
  return String(value || "active")
    .trim()
    .toLowerCase();
}

export default async function getCurrentUserService(
  uid,
) {
  if (!uid) {
    throw createHttpError(
      "Usuario no autenticado.",
      401,
    );
  }

  const userRef =
    db.collection("user").doc(uid);

  const userSnap =
    await userRef.get();

  if (!userSnap.exists) {
    throw createHttpError(
      "Usuario no encontrado.",
      404,
    );
  }

  const userData =
    userSnap.data() || {};

  const status =
    normalizeStatus(userData.status);

  /*
   * Los usuarios advertidos o en revisión
   * pueden seguir usando la aplicación.
   *
   * Únicamente se impide el acceso cuando
   * la cuenta está realmente bloqueada.
   */
  if (
    BLOCKED_USER_STATUSES.has(status)
  ) {
    throw createHttpError(
      "La cuenta está bloqueada.",
      403,
    );
  }

  return {
    uid:
      userData.uid ||
      uid,

    name:
      userData.name ||
      "",

    email:
      userData.email ||
      "",

    photoURL:
      userData.photoURL ||
      null,

    provider:
      userData.provider ||
      null,

    emailVerified:
      Boolean(
        userData.emailVerified,
      ),

    status,
  };
}