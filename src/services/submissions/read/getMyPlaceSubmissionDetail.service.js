import { db } from "../../../config/firebase.js";

const DEFAULT_OPENING_HOURS = {
  type: "not_specified",
  days: [],
  openTime: null,
  closeTime: null,
  label: "Horario no especificado",
};

function formatFirestoreDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function normalizeOpeningHours(openingHours) {
  if (!openingHours || typeof openingHours !== "object") {
    return DEFAULT_OPENING_HOURS;
  }

  const validTypes = ["defined", "always_open", "not_specified"];

  const type = validTypes.includes(openingHours.type)
    ? openingHours.type
    : "not_specified";

  if (type === "always_open") {
    return {
      type: "always_open",
      days: [],
      openTime: null,
      closeTime: null,
      label: openingHours.label || "Abierto 24 horas",
    };
  }

  if (type === "not_specified") {
    return {
      type: "not_specified",
      days: [],
      openTime: null,
      closeTime: null,
      label: openingHours.label || "Horario no especificado",
    };
  }

  return {
    type: "defined",
    days: Array.isArray(openingHours.days) ? openingHours.days : [],
    openTime: openingHours.openTime ?? null,
    closeTime: openingHours.closeTime ?? null,
    label: openingHours.label || "Horario definido",
  };
}

function getPhotoUrl(photo, preferredSize = "medium") {
  if (!photo) return null;

  if (typeof photo === "string") {
    return photo;
  }

  if (preferredSize === "thumbnail") {
    return (
      photo.thumbnailUrl ||
      photo.thumbnail?.url ||
      photo.displayUrl ||
      photo.mediumUrl ||
      photo.medium?.url ||
      photo.originalUrl ||
      photo.original?.url ||
      photo.thumbnailURL ||
      photo.mediumURL ||
      photo.downloadURL ||
      photo.url ||
      photo.imageUrl ||
      photo.photoUrl ||
      photo.uri ||
      photo.src ||
      null
    );
  }

  if (preferredSize === "original") {
    return (
      photo.originalUrl ||
      photo.original?.url ||
      photo.downloadURL ||
      photo.displayUrl ||
      photo.mediumUrl ||
      photo.medium?.url ||
      photo.thumbnailUrl ||
      photo.thumbnail?.url ||
      photo.mediumURL ||
      photo.thumbnailURL ||
      photo.url ||
      photo.imageUrl ||
      photo.photoUrl ||
      photo.uri ||
      photo.src ||
      null
    );
  }

  return (
    photo.displayUrl ||
    photo.mediumUrl ||
    photo.medium?.url ||
    photo.originalUrl ||
    photo.original?.url ||
    photo.thumbnailUrl ||
    photo.thumbnail?.url ||
    photo.mediumURL ||
    photo.downloadURL ||
    photo.thumbnailURL ||
    photo.url ||
    photo.imageUrl ||
    photo.photoUrl ||
    photo.uri ||
    photo.src ||
    null
  );
}

function normalizePhoto(photo, index) {
  if (!photo) return null;

  const originalUrl = getPhotoUrl(photo, "original");
  const mediumUrl = getPhotoUrl(photo, "medium");
  const thumbnailUrl = getPhotoUrl(photo, "thumbnail");

  const displayUrl = mediumUrl || originalUrl || thumbnailUrl;

  if (!displayUrl) return null;

  if (typeof photo === "string") {
    return {
      photoId: `photo_${index + 1}`,

      url: displayUrl,
      imageUrl: displayUrl,
      fullUrl: displayUrl,

      originalUrl: displayUrl,
      mediumUrl: displayUrl,
      thumbnailUrl: displayUrl,
      displayUrl,

      original: {
        url: displayUrl,
        path: null,
        fileName: null,
        width: null,
        height: null,
        size: null,
        mimeType: null,
      },

      medium: {
        url: displayUrl,
        path: null,
        fileName: null,
        width: null,
        height: null,
        mimeType: null,
      },

      thumbnail: {
        url: displayUrl,
        path: null,
        fileName: null,
        width: null,
        height: null,
        mimeType: null,
      },

      source: "legacy",
      uploadedAt: null,
    };
  }

  return {
    ...photo,

    photoId: photo.photoId || `photo_${index + 1}`,

    url: displayUrl,
    imageUrl: displayUrl,
    fullUrl: originalUrl || displayUrl,

    originalUrl,
    mediumUrl,
    thumbnailUrl,
    displayUrl,

    original: {
      url: originalUrl,
      path: photo.original?.path || photo.storagePath || null,
      fileName: photo.original?.fileName || photo.fileName || null,
      width: photo.original?.width ?? photo.width ?? null,
      height: photo.original?.height ?? photo.height ?? null,
      size: photo.original?.size ?? photo.fileSize ?? null,
      mimeType: photo.original?.mimeType || photo.mimeType || null,
    },

    medium: {
      url: mediumUrl,
      path: photo.medium?.path || photo.mediumPath || null,
      fileName: photo.medium?.fileName || photo.mediumFileName || null,
      width: photo.medium?.width ?? photo.mediumWidth ?? null,
      height: photo.medium?.height ?? photo.mediumHeight ?? null,
      mimeType: photo.medium?.mimeType || "image/jpeg",
    },

    thumbnail: {
      url: thumbnailUrl,
      path: photo.thumbnail?.path || photo.thumbnailPath || null,
      fileName: photo.thumbnail?.fileName || photo.thumbnailFileName || null,
      width: photo.thumbnail?.width ?? photo.thumbnailWidth ?? null,
      height: photo.thumbnail?.height ?? photo.thumbnailHeight ?? null,
      mimeType: photo.thumbnail?.mimeType || "image/jpeg",
    },

    source: photo.source || "user",
    uploadedAt: photo.uploadedAt || null,
  };
}

function getPhotos(data) {
  const rawPhotos = data.photos || data.images || data.photoUrls || [];

  if (!Array.isArray(rawPhotos)) {
    return [];
  }

  return rawPhotos
    .map((photo, index) => normalizePhoto(photo, index))
    .filter(Boolean);
}

function getCoordinates(data) {
  const location =
    data.location ||
    data.coordinates ||
    data.mapLocation ||
    data.selectedLocation ||
    data.placeLocation ||
    null;

  if (location?.latitude && location?.longitude) {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }

  if (location?.lat && location?.lng) {
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  }

  if (data.latitude && data.longitude) {
    return {
      latitude: data.latitude,
      longitude: data.longitude,
    };
  }

  return null;
}

function mapSubmissionDetail(doc) {
  const data = doc.data();
  const photos = getPhotos(data);
  const coordinates = getCoordinates(data);
  const openingHours = normalizeOpeningHours(data.openingHours);

  return {
    id: data.placeSubmissionId || doc.id,
    placeSubmissionId: data.placeSubmissionId || doc.id,

    name: data.name || "Lugar sin nombre",
    description: data.description || "",
    price: data.price || null,

    openingHours,

    // Alias por compatibilidad con pantallas que todavía usen schedule.
    schedule: openingHours.label,

    tagId: data.tagId || null,
    tag: data.tagLabel || "Sin categoría",
    tagLabel: data.tagLabel || "Sin categoría",

    subtags: Array.isArray(data.subtags) ? data.subtags : [],
    approaches: Array.isArray(data.approaches) ? data.approaches : [],

    status: data.status || "in_review",
    source: data.source || null,

    imageUrl:
      photos[0]?.mediumUrl ||
      photos[0]?.displayUrl ||
      photos[0]?.imageUrl ||
      photos[0]?.thumbnailUrl ||
      null,

    thumbnailUrl:
      photos[0]?.thumbnailUrl ||
      photos[0]?.mediumUrl ||
      photos[0]?.displayUrl ||
      null,

    photos,

    coordinates,
    location: coordinates,

    createdAt: formatFirestoreDate(data.createdAt),
    returnedAt: formatFirestoreDate(data.returnedAt),
    updatedAt: formatFirestoreDate(data.updatedAt),
  };
}

async function findSubmissionById(submissionId) {
  const directDoc = await db
    .collection("placeSubmissions")
    .doc(submissionId)
    .get();

  if (directDoc.exists) {
    return directDoc;
  }

  const snapshot = await db
    .collection("placeSubmissions")
    .where("placeSubmissionId", "==", submissionId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0];
}

export default async function getMyPlaceSubmissionDetailService({
  uid,
  submissionId,
}) {
  if (!uid) {
    throw new Error("Falta uid para obtener el detalle de la propuesta.");
  }

  if (!submissionId) {
    throw new Error("Falta submissionId para obtener el detalle.");
  }

  const doc = await findSubmissionById(submissionId);

  if (!doc) {
    return null;
  }

  const data = doc.data();

  if (data.createdBy !== uid) {
    const error = new Error("No tienes permiso para ver esta propuesta.");
    error.statusCode = 403;
    throw error;
  }

  return mapSubmissionDetail(doc);
}