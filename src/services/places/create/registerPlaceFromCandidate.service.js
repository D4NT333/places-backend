import { FieldValue } from "firebase-admin/firestore";
import { latLngToCell } from "h3-js";
import { db } from "../../../config/firebase.js";

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizePriceRangeId(price) {
  if (!price) return null;

  if (typeof price === "string") {
    return price;
  }

  if (typeof price === "object") {
    return price.id || price.priceRangeId || null;
  }

  return String(price);
}

function normalizeOpeningHours(openingHours) {
  if (!openingHours) {
    return {
      type: "not_specified",
      label: "Horario no especificado",
      days: [],
      openTime: null,
      closeTime: null,
      isOpenNow: false,
      lastScheduleCheckAt: null,
    };
  }

  if (typeof openingHours === "string") {
    return {
      type: "defined",
      label: openingHours,
      days: [],
      openTime: null,
      closeTime: null,
      isOpenNow: false,
      lastScheduleCheckAt: null,
    };
  }

  if (typeof openingHours === "object") {
    return {
      type: openingHours.type || "defined",
      label: openingHours.label || "",
      days: Array.isArray(openingHours.days) ? openingHours.days : [],
      openTime: openingHours.openTime || null,
      closeTime: openingHours.closeTime || null,
      isOpenNow: Boolean(openingHours.isOpenNow),
      lastScheduleCheckAt: openingHours.lastScheduleCheckAt || null,
    };
  }

  return {
    type: "not_specified",
    label: "Horario no especificado",
    days: [],
    openTime: null,
    closeTime: null,
    isOpenNow: false,
    lastScheduleCheckAt: null,
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
    .filter((photo) => photo?.name || photo?.photoReference || photo?.reference)
    .map((photo, index) => ({
      source: "google",
      reference: photo.name || photo.photoReference || photo.reference,
      widthPx: photo.widthPx ?? null,
      heightPx: photo.heightPx ?? null,
      order: index,
    }));
}

function getMainPhoto(photos = []) {
  if (!Array.isArray(photos) || photos.length === 0) return null;

  const firstPhoto = photos[0];

  return {
    source: firstPhoto.source || "google",
    reference: firstPhoto.reference || null,
    order: firstPhoto.order ?? 0,
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
    priceRangeId,

    schedule,
    openingHours,

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
    .where("origin.googlePlaceId", "==", googlePlaceId)
    .limit(1)
    .get();

  if (!existingPlaceSnap.empty) {
    throw createHttpError("Este lugar ya existe en places.", 409);
  }

  const placeRef = db.collection("places").doc();
  const placeId = placeRef.id;

  const now = FieldValue.serverTimestamp();
  const adminUid = adminUser?.uid || "admin_uid_or_system";

  const h3Resolution = 9;
  const placeHexId = latLngToCell(lat, lng, h3Resolution);

  const normalizedPhotos = normalizeGooglePhotoReferences(photos);
  const mainPhoto = getMainPhoto(normalizedPhotos);

  const normalizedOpeningHours = normalizeOpeningHours(
    openingHours || schedule || null
  );

  const normalizedPriceRangeId = normalizePriceRangeId(
    priceRangeId || price || null
  );

  const placeData = {
    placeId,

    origin: {
      type: "google_candidate",
      googlePlaceId,
      submissionId: null,
      candidateId: candidateRef.id,
      submittedBy: null,
      approvedBy: adminUid,
      approvedAt: now,
    },

    status,
    createdBy: adminUid,

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

    priceRangeId: normalizedPriceRangeId,

    googleData: {
      rating: googleData.rating ?? candidateData.rating ?? null,
      userRatingCount:
        googleData.userRatingCount ?? candidateData.userRatingCount ?? null,
      googleMapsUri:
        googleData.googleMapsUri ?? candidateData.googleMapsUri ?? null,
      googleDataFetchedAt:
        googleData.googleDataFetchedAt ??
        candidateData.googleDataFetchedAt ??
        null,
    },

    trend: {
      score: 0,
      weeklyViews: 0,
      weeklyLikes: 0,
      weeklySaves: 0,
      weeklyPhotos: 0,
      weeklyReviews: 0,
      weeklyRatingAverage: 0,
      calculatedAt: null,
      periodStart: null,
      periodEnd: null,
    },

    metrics: {
      viewsCount: 0,
      likesCount: 0,
      savesCount: 0,
      sharesCount: 0,
      commentsCount: 0,
      ratingsCount: 0,
      reportsCount: 0,
      ratingSum: 0,
      internalRating: 0,
      ratingConfidence: 0,
      photoProposalsCount: 0,
      averageRating: 0,
    },

    openingHours: normalizedOpeningHours,

    deletedAt: null,
    updatedAt: now,
    createdAt: now,
    lastInteractionAt: null,

    photos: normalizedPhotos,
    mainPhoto,
    photoCount: normalizedPhotos.length,
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(placeRef, placeData);

    transaction.update(candidateRef, {
      status: "accepted",
      createdPlaceId: placeId,
      acceptedAt: now,
      reviewedBy: adminUid,
      updatedAt: now,
    });
  });

  return {
    placeId,
    candidateId: candidateRef.id,
    googlePlaceId,
  };
}