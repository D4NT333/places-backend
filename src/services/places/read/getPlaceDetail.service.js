import { db } from "../../../config/firebase.js";

const SUBTAGS_COLLECTION = "subtag";

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

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePhoto(photo) {
  if (!photo || typeof photo !== "object") return null;

  const reference = cleanText(photo.reference);

  if (!reference) return null;

  return {
    source: cleanText(photo.source),
    reference,
    widthPx: toNumberOrNull(photo.widthPx),
    heightPx: toNumberOrNull(photo.heightPx),
    order: toNumberOrZero(photo.order),
  };
}

function buildPhotoUrl(baseUrl, reference) {
  const cleanReference = cleanText(reference);

  if (!cleanReference) return null;

  return `${baseUrl}/api/places/photos/google?reference=${encodeURIComponent(
    cleanReference
  )}`;
}

function normalizePhotos(photos, mainPhoto, baseUrl) {
  const normalizedPhotos = Array.isArray(photos)
    ? photos.map(normalizePhoto).filter(Boolean)
    : [];

  const normalizedMainPhoto = normalizePhoto(mainPhoto);

  const finalPhotos =
    normalizedPhotos.length > 0
      ? normalizedPhotos
      : normalizedMainPhoto
        ? [normalizedMainPhoto]
        : [];

  return finalPhotos
    .sort((a, b) => a.order - b.order)
    .map((photo, index) => ({
      id: `${photo.reference}-${index}`,
      source: photo.source,
      reference: photo.reference,
      url: buildPhotoUrl(baseUrl, photo.reference),
      widthPx: photo.widthPx,
      heightPx: photo.heightPx,
      order: photo.order,
    }))
    .filter((photo) => Boolean(photo.url));
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

  return labels.map(cleanText).filter(Boolean);
}

function normalizeGoogleRating(place) {
  const googleRating = place?.googleData?.rating;

  if (Number.isFinite(Number(googleRating)) && Number(googleRating) > 0) {
    return Number(googleRating);
  }

  return 0;
}

function normalizeLsearchRating(place) {
  const averageRating = place?.metrics?.averageRating;

  if (Number.isFinite(Number(averageRating)) && Number(averageRating) > 0) {
    return Number(averageRating);
  }

  return 0;
}

function normalizeLocation(location) {
  return {
    lat: Number.isFinite(Number(location?.lat)) ? Number(location.lat) : null,
    lng: Number.isFinite(Number(location?.lng)) ? Number(location.lng) : null,
  };
}

async function findPlaceDocById(placeId) {
  const cleanPlaceId = cleanText(placeId);

  if (!cleanPlaceId) return null;

  const directDoc = await db.collection("places").doc(cleanPlaceId).get();

  if (directDoc.exists) {
    return directDoc;
  }

  const byPlaceIdSnapshot = await db
    .collection("places")
    .where("placeId", "==", cleanPlaceId)
    .limit(1)
    .get();

  if (!byPlaceIdSnapshot.empty) {
    return byPlaceIdSnapshot.docs[0];
  }

  return null;
}

export default async function getPlaceDetailService({ placeId, baseUrl }) {
  const placeDoc = await findPlaceDocById(placeId);

  if (!placeDoc) {
    const error = new Error("No se encontró el lugar solicitado.");
    error.statusCode = 404;
    throw error;
  }

  const place = placeDoc.data();

  if (place.deletedAt) {
    const error = new Error("El lugar ya no está disponible.");
    error.statusCode = 404;
    throw error;
  }

  if (cleanText(place.status) !== "published") {
    const error = new Error("El lugar no está publicado.");
    error.statusCode = 404;
    throw error;
  }

  const subtagsWithLabels = await normalizeSubtagsWithLabels(place.subtags);

  const tagLabel = cleanText(place.tagLabel);

  const tags = [
    tagLabel,
    ...subtagsWithLabels,
  ].filter(Boolean);

  const googleRating = normalizeGoogleRating(place);
  const lsearchRating = normalizeLsearchRating(place);

  const googleUserRatingCount = toNumberOrZero(
    place?.googleData?.userRatingCount
  );

  const lsearchRatingsCount = toNumberOrZero(place?.metrics?.ratingsCount);
  const commentsCount = toNumberOrZero(place?.metrics?.commentsCount);

  const images = normalizePhotos(place.photos, place.mainPhoto, baseUrl);

  return {
    place: {
      id: placeDoc.id,
      placeId: cleanText(place.placeId) || placeDoc.id,

      name: cleanText(place.name),
      description: cleanText(place.description),
      address: cleanText(place.address),

      location: normalizeLocation(place.location),

      isOpen: Boolean(place.openingHours?.isOpenNow),
      openingHoursLabel: cleanText(place.openingHours?.label),

      images,

      googleRating,
      lsearchRating,

      tags,

      tagId: cleanText(place.tagId),
      tagLabel,
      subtags: subtagsWithLabels,
      approaches: normalizeStringArray(place.approaches),

      googleMapsUri: cleanText(place?.googleData?.googleMapsUri),

      lsearchSummary: {
        averageRating: lsearchRating,
        ratingsCount: lsearchRatingsCount,
        commentsCount,
        recommendsPercent: 0,
      },

      googleSummary: {
        averageRating: googleRating,
        ratingsCount: googleUserRatingCount,
      },

      metrics: {
        viewsCount: toNumberOrZero(place?.metrics?.viewsCount),
        likesCount: toNumberOrZero(place?.metrics?.likesCount),
        savesCount: toNumberOrZero(place?.metrics?.savesCount),
        sharesCount: toNumberOrZero(place?.metrics?.sharesCount),
        commentsCount,
        ratingsCount: lsearchRatingsCount,
      },
    },

    lsearchReviews: [],
    googleReviews: [],
  };
}