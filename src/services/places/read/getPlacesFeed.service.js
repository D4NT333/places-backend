import { db } from "../../../config/firebase.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;

const SUBTAGS_COLLECTION = "subtag";
const HOME_MAX_SUBTAGS = 2;

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMainPhoto(mainPhoto) {
  if (!mainPhoto || typeof mainPhoto !== "object") {
    return null;
  }

  return {
    source: cleanText(mainPhoto.source),
    reference: cleanText(mainPhoto.reference),
    order: Number.isFinite(Number(mainPhoto.order))
      ? Number(mainPhoto.order)
      : 0,
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
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

  return null;
}

function normalizeUserRatingCount(place) {
  const userRatingCount = place?.googleData?.userRatingCount;
  const ratingsCount = place?.metrics?.ratingsCount;

  if (Number.isFinite(Number(userRatingCount)) && Number(userRatingCount) > 0) {
    return Number(userRatingCount);
  }

  if (Number.isFinite(Number(ratingsCount)) && Number(ratingsCount) > 0) {
    return Number(ratingsCount);
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

  const subtagLabels = await Promise.all(
    cleanSubtags.map((subtagId) => getSubtagLabelById(subtagId))
  );

  return subtagLabels.map(cleanText).filter(Boolean);
}

function buildHomeTags({ tagLabel, subtags }) {
  const cleanTagLabel = cleanText(tagLabel);

  const visibleSubtags = Array.isArray(subtags)
    ? subtags.slice(0, HOME_MAX_SUBTAGS)
    : [];

  return [cleanTagLabel, ...visibleSubtags]
    .map(cleanText)
    .filter(Boolean);
}

async function mapPlaceForFeed(doc) {
  const place = doc.data();

  const subtagsWithLabels = await normalizeSubtagsWithLabels(place.subtags);
  const tagLabel = cleanText(place.tagLabel);

  return {
    id: doc.id,
    placeId: cleanText(place.placeId) || doc.id,

    name: cleanText(place.name),

    mainPhoto: normalizeMainPhoto(place.mainPhoto),

    rating: normalizeRating(place),
    userRatingCount: normalizeUserRatingCount(place),

    tagId: cleanText(place.tagId),
    tagLabel,

    // Aquí van TODOS los subtags ya traducidos.
    subtags: subtagsWithLabels,

    // Esto se queda, pero Home no lo usará.
    approaches: normalizeStringArray(place.approaches),

    // Esto es lo que debe usar la card del Home.
    // Máximo: tag principal + 2 subtags.
    tags: buildHomeTags({
      tagLabel,
      subtags: subtagsWithLabels,
    }),

    openingHoursLabel: cleanText(place.openingHours?.label),
    isOpenNow: Boolean(place.openingHours?.isOpenNow),

    priceRangeId: cleanText(place.priceRangeId),

    location: {
      lat: Number.isFinite(Number(place.location?.lat))
        ? Number(place.location.lat)
        : null,
      lng: Number.isFinite(Number(place.location?.lng))
        ? Number(place.location.lng)
        : null,
    },
  };
}

export default async function getPlacesFeedService({ limit, cursor } = {}) {
  const safeLimit = normalizeLimit(limit);

  let query = db
    .collection("places")
    .where("status", "==", "published")
    .where("deletedAt", "==", null)
    .orderBy("updatedAt", "desc")
    .limit(safeLimit + 1);

  if (cursor) {
    const cursorDoc = await db.collection("places").doc(cursor).get();

    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();

  const docs = snapshot.docs;
  const hasMore = docs.length > safeLimit;
  const pageDocs = hasMore ? docs.slice(0, safeLimit) : docs;

  const places = await Promise.all(pageDocs.map(mapPlaceForFeed));

  const lastDoc = pageDocs[pageDocs.length - 1];

  return {
    places,
    nextCursor: hasMore && lastDoc ? lastDoc.id : null,
    hasMore,
  };
}