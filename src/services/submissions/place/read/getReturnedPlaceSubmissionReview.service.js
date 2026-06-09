import { db } from "../../../../config/firebase.js";

function formatTimestamp(timestamp) {
  if (!timestamp) return null;

  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate().toISOString();
  }

  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  return timestamp;
}

function getPhotoUrl(photo, preferredSize = "medium") {
  if (!photo) return null;

  if (typeof photo === "string") return photo;

  if (preferredSize === "thumbnail") {
    return (
      photo.thumbnailUrl ||
      photo.thumbnail?.url ||
      photo.previewURL ||
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
      photo.fullUrl ||
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
  const previewURL = thumbnailUrl || mediumUrl || originalUrl;

  if (!displayUrl && !previewURL) return null;

  if (typeof photo === "string") {
    return {
      photoId: `photo_${index + 1}`,

      original: {
        url: photo,
        path: null,
        fileName: null,
        width: null,
        height: null,
        size: null,
        mimeType: null,
      },

      medium: {
        url: photo,
        path: null,
        fileName: null,
        width: null,
        height: null,
        mimeType: null,
      },

      thumbnail: {
        url: photo,
        path: null,
        fileName: null,
        width: null,
        height: null,
        mimeType: null,
      },

      source: "legacy",
      uploadedAt: null,

      url: photo,
      imageUrl: photo,
      fullUrl: photo,
      previewURL: photo,
      displayUrl: photo,
      originalUrl: photo,
      mediumUrl: photo,
      thumbnailUrl: photo,
    };
  }

  return {
    ...photo,

    photoId: photo.photoId || photo.id || `photo_${index + 1}`,

    original: {
      url: originalUrl,
      path: photo.original?.path || photo.storagePath || photo.path || null,
      fileName: photo.original?.fileName || photo.fileName || null,
      width: photo.original?.width ?? photo.width ?? null,
      height: photo.original?.height ?? photo.height ?? null,
      size: photo.original?.size ?? photo.fileSize ?? photo.size ?? null,
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

    url: displayUrl,
    imageUrl: displayUrl,
    fullUrl: originalUrl || displayUrl,
    previewURL,
    displayUrl,
    originalUrl,
    mediumUrl,
    thumbnailUrl,
  };
}

function normalizePhotos(photos = []) {
  if (!Array.isArray(photos)) return [];

  return photos
    .map((photo, index) => normalizePhoto(photo, index))
    .filter(Boolean);
}

function normalizeReturnFields(fields = {}) {
  return {
    name: fields.name || { selected: false, message: "" },
    description: fields.description || { selected: false, message: "" },
    tag: fields.tag || { selected: false, message: "" },
    subtags: fields.subtags || { selected: false, message: "" },
    approaches: fields.approaches || { selected: false, message: "" },
    price: fields.price || { selected: false, message: "" },
    schedule: fields.schedule || { selected: false, message: "" },
    photos: fields.photos || { selected: false, message: "", items: [] },
    location: fields.location || { selected: false, message: "" },
  };
}

function normalizeSnapshot(snapshot = {}) {
  return {
    name: snapshot.name || "",
    description: snapshot.description || "",

    tagId: snapshot.tagId || null,
    tagLabel: snapshot.tagLabel || snapshot.tag || null,

    subtags: Array.isArray(snapshot.subtags) ? snapshot.subtags : [],
    approaches: Array.isArray(snapshot.approaches) ? snapshot.approaches : [],

    price: snapshot.price || snapshot.priceLabel || null,
    schedule: snapshot.schedule || null,

    location: snapshot.location || snapshot.coordinates || null,

    photos: normalizePhotos(snapshot.photos),
  };
}

export default async function getReturnedPlaceSubmissionReviewService(
  submissionId
) {
  if (!submissionId) {
    const error = new Error("Falta submissionId.");
    error.statusCode = 400;
    throw error;
  }

  const returnsSnap = await db
    .collection("placeSubmissionReturns")
    .where("submissionId", "==", submissionId)
    .orderBy("returnedAt", "desc")
    .limit(1)
    .get();

  if (returnsSnap.empty) {
    const error = new Error("No se encontró información de devolución.");
    error.statusCode = 404;
    throw error;
  }

  const doc = returnsSnap.docs[0];
  const data = doc.data();

  const rawFields = data.fields || data.returnFields || {};
  const returnFields = normalizeReturnFields(rawFields);

  return {
    id: doc.id,
    returnId: data.returnId || doc.id,
    submissionId: data.submissionId || submissionId,

    generalMessage: data.generalMessage || "",

    fields: returnFields,
    returnFields,

    resolved: Boolean(data.resolved),
    returnedBy: data.returnedBy || null,
    returnedAt: formatTimestamp(data.returnedAt),
    resolvedAt: formatTimestamp(data.resolvedAt),
    resolvedBy: data.resolvedBy || null,

    snapshotBeforeReturn: normalizeSnapshot(data.snapshotBeforeReturn || {}),
  };
}