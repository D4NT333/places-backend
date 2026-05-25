import { FieldValue } from "firebase-admin/firestore";
import { latLngToCell } from "h3-js";
import { db } from "../../../config/firebase.js";

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizePrice(price) {
  if (!price) {
    return {
      id: null,
      label: "",
      level: null,
    };
  }

  if (typeof price === "object") {
    return price;
  }

  return {
    id: price,
    label: String(price),
    level: null,
  };
}

function normalizeSchedule(schedule) {
  if (!schedule) return null;

  if (typeof schedule === "object") {
    return schedule;
  }

  return {
    id: schedule,
    label: String(schedule),
  };
}

function normalizeLocation(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const lat = location.lat ?? location.latitude;
  const lng = location.lng ?? location.longitude;

  if (lat === undefined || lng === undefined) {
    return null;
  }

  const normalizedLat = Number(lat);
  const normalizedLng = Number(lng);

  if (Number.isNaN(normalizedLat) || Number.isNaN(normalizedLng)) {
    return null;
  }

  return {
    lat: normalizedLat,
    lng: normalizedLng,
  };
}

function normalizeGooglePhotoReferences(photos = []) {
  if (!Array.isArray(photos)) return [];

  return photos
    .filter((photo) => photo?.name || photo?.photoReference)
    .map((photo, index) => ({
      source: "google",
      photoReference: photo.name || photo.photoReference,
      widthPx: photo.widthPx || null,
      heightPx: photo.heightPx || null,
      authorAttributions: photo.authorAttributions || [],
      order: index,
      status: "active",
    }));
}

function getMainPhoto(photos = []) {
  if (!Array.isArray(photos) || photos.length === 0) return null;

  const firstPhoto = photos[0];

  return {
    source: firstPhoto.source || "google",
    photoReference: firstPhoto.photoReference || null,
    widthPx: firstPhoto.widthPx || null,
    heightPx: firstPhoto.heightPx || null,
    authorAttributions: firstPhoto.authorAttributions || [],
    order: firstPhoto.order ?? 0,
    status: firstPhoto.status || "active",
  };
}

async function findCandidateRef({ candidateId, googlePlaceId }) {
  const directRef = db.collection("candidatesPlaces").doc(candidateId);
  const directSnap = await directRef.get();

  if (directSnap.exists) {
    return {
      ref: directRef,
      snap: directSnap,
    };
  }

  const querySnap = await db
    .collection("candidatesPlaces")
    .where("googlePlaceId", "==", googlePlaceId)
    .limit(1)
    .get();

  if (querySnap.empty) {
    return null;
  }

  const candidateDoc = querySnap.docs[0];

  return {
    ref: candidateDoc.ref,
    snap: candidateDoc,
  };
}

export default async function registerPlaceFromCandidateService({
  body,
  adminUser,
}) {
  const {
    candidateId,
    googlePlaceId,

    source = "google",
    status = "published",

    name,
    description,
    address,

    location,
    parentHexId,

    tagId,
    tagLabel = "",
    subtags = [],
    approaches = [],
    price,

    schedule,

    googleData = {},
    photos = [],
  } = body;

  if (!candidateId) {
    throw createHttpError("El candidateId es obligatorio.", 400);
  }

  if (!googlePlaceId) {
    throw createHttpError("El googlePlaceId es obligatorio.", 400);
  }

  if (!name?.trim()) {
    throw createHttpError("El nombre del lugar es obligatorio.", 400);
  }

  if (!description?.trim()) {
    throw createHttpError("La descripción del lugar es obligatoria.", 400);
  }

  if (!tagId) {
    throw createHttpError("La etiqueta principal es obligatoria.", 400);
  }

  if (!Array.isArray(subtags) || subtags.length === 0) {
    throw createHttpError("Selecciona al menos una subetiqueta.", 400);
  }

  if (!Array.isArray(approaches) || approaches.length === 0) {
    throw createHttpError("Selecciona al menos un enfoque.", 400);
  }

const normalizedLocation = normalizeLocation(location);

if (!normalizedLocation) {
  throw createHttpError("La ubicación del lugar es obligatoria.", 400);
}

const { lat, lng } = normalizedLocation;

  const candidateResult = await findCandidateRef({
    candidateId,
    googlePlaceId,
  });

  if (!candidateResult) {
    throw createHttpError("El candidato no existe en candidatesPlaces.", 404);
  }

  const { ref: candidateRef, snap: candidateSnap } = candidateResult;
  const candidateData = candidateSnap.data();

  const existingPlaceSnap = await db
    .collection("places")
    .where("googlePlaceId", "==", googlePlaceId)
    .limit(1)
    .get();

  if (!existingPlaceSnap.empty) {
    throw createHttpError("Este lugar ya existe en places.", 409);
  }

  const placeRef = db.collection("places").doc();
  const placeId = placeRef.id;

  const now = FieldValue.serverTimestamp();

  const h3Resolution = 9;
  const placeHexId = latLngToCell(lat, lng, h3Resolution);

  const normalizedPhotos = normalizeGooglePhotoReferences(photos);
  const mainPhoto = getMainPhoto(normalizedPhotos);
  const normalizedSchedule = normalizeSchedule(schedule);

  const placeData = {
    placeId,
    googlePlaceId,
    source,
    status,

    createdFromSubmissionId: null,
    createdBy: null,
    approvedBy: adminUser?.uid || "admin_uid_or_system",

    name: name.trim(),
    description: description.trim(),
    address: address || candidateData.address || "",

    location: {
      lat,
      lng,
    },

    parentHexId: parentHexId || candidateData.parentHexId || null,
    placeHexId,
    h3Resolution,

    tagId,
    tagLabel,
    subtags,
    approaches,
    price: normalizePrice(price),

    schedule: normalizedSchedule,
    isOpenNow: false,
    lastScheduleCheckAt: null,

    photos: normalizedPhotos,
    mainPhoto,
    photoCount: normalizedPhotos.length,

    metrics: {
      viewsCount: 0,
      likesCount: 0,
      savesCount: 0,
      sharesCount: 0,
      commentsCount: 0,
      ratingsCount: 0,
      averageRating: 0,
    },

    trend: {
      score: 0,
      weeklyViews: 0,
      weeklyLikes: 0,
      weeklySaves: 0,
      weeklyRatingAverage: 0,
      calculatedAt: null,
      periodStart: null,
      periodEnd: null,
    },

    googleData: {
      googleMainType:
        googleData.googleMainType || candidateData.googleMainType || null,

      types: Array.isArray(googleData.types)
        ? googleData.types
        : Array.isArray(candidateData.types)
          ? candidateData.types
          : [],

      rating: googleData.rating ?? null,
      userRatingCount: googleData.userRatingCount ?? null,
      priceLevel: googleData.priceLevel || null,
      googleMapsUri: googleData.googleMapsUri || null,
      openingHours: googleData.openingHours || null,

      googleDataFetchedAt: candidateData.googleDataFetchedAt || null,
      googleDataExpiresAt: candidateData.googleDataExpiresAt || null,
    },

    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    lastInteractionAt: null,
    lastImportedAt: candidateData.createdAt || null,
    deletedAt: null,
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(placeRef, placeData);

    transaction.update(candidateRef, {
      status: "accepted",
      createdPlaceId: placeId,
      acceptedAt: now,
      reviewedBy: adminUser?.uid || "admin_uid_or_system",
      updatedAt: now,
    });
  });

  return {
    placeId,
    candidateId: candidateRef.id,
    googlePlaceId,
  };
}