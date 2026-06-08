import { db } from "../../../config/firebase.js";

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMainPhoto(mainPhoto) {
  if (!mainPhoto || typeof mainPhoto !== "object") return null;

  return {
    source: cleanText(mainPhoto.source),
    reference: cleanText(mainPhoto.reference),
    order: Number.isFinite(Number(mainPhoto.order))
      ? Number(mainPhoto.order)
      : 0,
  };
}

function mapFavoriteDoc(doc) {
  const favorite = doc.data();

  return {
    id: doc.id,
    placeId: cleanText(favorite.placeId) || doc.id,

    placeName: cleanText(favorite.placeName),

    tagId: cleanText(favorite.tagId),
    tagLabel: cleanText(favorite.tagLabel),

    subtags: normalizeStringArray(favorite.subtags),

    rating: Number.isFinite(Number(favorite.rating))
      ? Number(favorite.rating)
      : 0,

    mainPhoto: normalizeMainPhoto(favorite.mainPhoto),

    createdAt: favorite.createdAt || null,
  };
}

export default async function listFavoritePlacesService({ uid }) {
  const cleanUid = cleanText(uid);

  if (!cleanUid) {
    throw createHttpError("Usuario no autenticado.", 401);
  }

  const snapshot = await db
    .collection("user")
    .doc(cleanUid)
    .collection("favorites")
    .orderBy("createdAt", "desc")
    .get();

  return {
    favorites: snapshot.docs.map(mapFavoriteDoc),
  };
}