import { Timestamp } from "firebase-admin/firestore";

/**
 * Convierte un cursor a Base64 para enviarlo al frontend.
 */
export function encodeCursor(data) {
  if (!data) {
    return null;
  }

  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

/**
 * Convierte un cursor Base64 nuevamente en objeto.
 */
export function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
  } catch {
    const error = new Error("El cursor proporcionado no es válido.");
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Convierte Timestamp, Date o string a ISO.
 */
export function serializeDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

/**
 * Obtiene los milisegundos de cualquier fecha compatible.
 */
export function getDateMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime())
    ? 0
    : parsedDate.getTime();
}

/**
 * Convierte milisegundos nuevamente en Timestamp de Firestore.
 */
export function millisToTimestamp(milliseconds) {
  const value = Number(milliseconds);

  if (!Number.isFinite(value)) {
    const error = new Error("El cursor contiene una fecha inválida.");
    error.statusCode = 400;
    throw error;
  }

  return Timestamp.fromMillis(value);
}