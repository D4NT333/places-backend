import { db, FieldValue } from "../../../config/firebase.js";

const SUBTAGS_COLLECTION = "subtag";

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

function normalizeRating(place) {
  const googleRating = place?.googleData?.rating;
  const averageRating = place?.metrics?.averageRating;

  if (Number.isFinite(Number(googleRating)) && Number(googleRating) > 0) {
    return Number(googleRating);
  }

  if (Number.isFinite(Number(averageRating)) && Number(averageRating) > 0) {
    return Number(averageRating);
  }

  return 0;
}

async function getSubtagLabelById(subtagId) {
  const cleanSubtagId = cleanText(subtagId);

  if (!cleanSubtagId) return "";

  try {
    const subtagDoc = await db
      .collection(SUBTAGS_COLLECTION)
      .doc(cleanSubtagId)
      .get();

    if (!subtagDoc.exists) {
      return cleanSubtagId;
    }

    const subtag = subtagDoc.data();

    return (
      cleanText(subtag.label) ||
      cleanText(subtag.name) ||
      cleanText(subtag.title) ||
      cleanSubtagId
    );
  } catch (error) {
    console.error("Error obteniendo label de subtag:", error);
    return cleanSubtagId;
  }
}

async function normalizeSubtagsWithLabels(subtags) {
  const cleanSubtags = normalizeStringArray(subtags);

  if (cleanSubtags.length === 0) return [];

  const labels = await Promise.all(
    cleanSubtags.map((subtagId) => getSubtagLabelById(subtagId))
  );

  return labels.map(cleanText).filter(Boolean).slice(0, 2);
}

async function findPlaceRefById(placeId) {
  const cleanPlaceId = cleanText(placeId);

  if (!cleanPlaceId) {
    throw createHttpError("El id del lugar es obligatorio.", 400);
  }

  const directRef = db.collection("places").doc(cleanPlaceId);
  const directDoc = await directRef.get();

  if (directDoc.exists) {
    return directRef;
  }

  const snapshot = await db
    .collection("places")
    .where("placeId", "==", cleanPlaceId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw createHttpError("No se encontró el lugar.", 404);
  }

  return snapshot.docs[0].ref;
}

export default async function toggleFavoritePlaceService({ uid, placeId }) {
  const cleanUid = cleanText(uid);

  if (!cleanUid) {
    throw createHttpError("Usuario no autenticado.", 401);
  }

  const placeRef = await findPlaceRefById(placeId);

  const placeDocForPreview = await placeRef.get();

  if (!placeDocForPreview.exists) {
    throw createHttpError("No se encontró el lugar.", 404);
  }

  const placeForPreview = placeDocForPreview.data();

  const subtagsWithLabels = await normalizeSubtagsWithLabels(
    placeForPreview.subtags
  );

  const userRef = db.collection("user").doc(cleanUid);
  const favoriteRef = userRef.collection("favorites").doc(placeRef.id);

  const result = await db.runTransaction(async (transaction) => {
    const [placeDoc, favoriteDoc] = await Promise.all([
      transaction.get(placeRef),
      transaction.get(favoriteRef),
    ]);

    if (!placeDoc.exists) {
      throw createHttpError("No se encontró el lugar.", 404);
    }

    const place = placeDoc.data();

    if (place.deletedAt) {
      throw createHttpError("Este lugar ya no está disponible.", 404);
    }

    if (cleanText(place.status) !== "published") {
      throw createHttpError("Este lugar no está publicado.", 400);
    }

    const currentSavesCount = Number(place?.metrics?.savesCount) || 0;

    if (favoriteDoc.exists) {
      const nextSavesCount = Math.max(currentSavesCount - 1, 0);

      transaction.delete(favoriteRef);

      transaction.update(placeRef, {
        "metrics.savesCount": nextSavesCount,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        isFavorite: false,
        savesCount: nextSavesCount,
      };
    }

    const nextSavesCount = currentSavesCount + 1;

    transaction.set(favoriteRef, {
      placeId: placeRef.id,
      placeName: cleanText(place.name),

      tagId: cleanText(place.tagId),
      tagLabel: cleanText(place.tagLabel),

      subtags: subtagsWithLabels,

      rating: normalizeRating(place),
      mainPhoto: normalizeMainPhoto(place.mainPhoto),

      createdAt: FieldValue.serverTimestamp(),
    });

    transaction.update(placeRef, {
      "metrics.savesCount": nextSavesCount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      isFavorite: true,
      savesCount: nextSavesCount,
    };
  });

  return result;
}