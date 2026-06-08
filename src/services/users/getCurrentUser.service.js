import { db } from "../../config/firebase.js";

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export default async function getCurrentUserService(uid) {
  if (!uid) {
    throw createHttpError("Usuario no autenticado.", 401);
  }

  const userRef = db.collection("user").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw createHttpError("Usuario no encontrado.", 404);
  }

  const userData = userSnap.data();

  if (userData.status && userData.status !== "active") {
    throw createHttpError("La cuenta no está activa.", 403);
  }

  return {
    uid: userData.uid || uid,
    name: userData.name || "",
    email: userData.email || "",
    photoURL: userData.photoURL || null,
    provider: userData.provider || null,
    emailVerified: Boolean(userData.emailVerified),
    status: userData.status || "active",
  };
}