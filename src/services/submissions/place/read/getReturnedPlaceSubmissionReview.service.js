import { db } from "../../../../config/firebase.js";

const SUBTAGS_COLLECTION = "subtag";
const APPROACHES_COLLECTION = "approach";

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

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getSubtagLabelById(subtagId) {
  const cleanSubtagId = cleanText(subtagId);

  if (!cleanSubtagId) return "";

  if (!cleanSubtagId.startsWith("subtag_")) {
    return cleanSubtagId;
  }

  try {
    const doc = await db
      .collection(SUBTAGS_COLLECTION)
      .doc(cleanSubtagId)
      .get();

    if (!doc.exists) {
      return cleanSubtagId;
    }

    const data = doc.data();

    return (
      cleanText(data.label) ||
      cleanText(data.name) ||
      cleanText(data.title) ||
      cleanSubtagId
    );
  } catch (error) {
    console.error("Error obteniendo label de subtag:", error);
    return cleanSubtagId;
  }
}

async function getApproachLabelById(approachId) {
  const cleanApproachId = cleanText(approachId);

  if (!cleanApproachId) return "";

  if (!cleanApproachId.startsWith("approach_")) {
    return cleanApproachId;
  }

  try {
    const doc = await db
      .collection(APPROACHES_COLLECTION)
      .doc(cleanApproachId)
      .get();

    if (!doc.exists) {
      return cleanApproachId;
    }

    const data = doc.data();

    return (
      cleanText(data.label) ||
      cleanText(data.name) ||
      cleanText(data.title) ||
      cleanApproachId
    );
  } catch (error) {
    console.error("Error obteniendo label de approach:", error);
    return cleanApproachId;
  }
}

async function normalizeSubtagDisplayLabels(labels, ids) {
  if (Array.isArray(labels) && labels.length > 0) {
    return labels
      .map(cleanText)
      .filter(Boolean);
  }

  const cleanIds = Array.isArray(ids)
    ? ids.map(cleanText).filter(Boolean)
    : [];

  const resolvedLabels = await Promise.all(
    cleanIds.map(getSubtagLabelById)
  );

  return resolvedLabels
    .map(cleanText)
    .filter(Boolean);
}

async function normalizeApproachDisplayLabels(labels, ids) {
  if (Array.isArray(labels) && labels.length > 0) {
    return labels
      .map(cleanText)
      .filter(Boolean);
  }

  const cleanIds = Array.isArray(ids)
    ? ids.map(cleanText).filter(Boolean)
    : [];

  const resolvedLabels = await Promise.all(
    cleanIds.map(getApproachLabelById)
  );

  return resolvedLabels
    .map(cleanText)
    .filter(Boolean);
}

async function normalizeSnapshot(snapshot = {}) {
  const subtagLabels = await normalizeSubtagDisplayLabels(
    snapshot.subtagLabels,
    snapshot.subtags
  );

  const approachLabels = await normalizeApproachDisplayLabels(
    snapshot.approachLabels,
    snapshot.approaches
  );

  return {
    name: snapshot.name || "",
    description: snapshot.description || "",

    tagId: snapshot.tagId || null,
    tagLabel: snapshot.tagLabel || snapshot.tag || null,

    subtagIds: Array.isArray(snapshot.subtags)
      ? snapshot.subtags
      : [],

    subtags: subtagLabels,

    approachIds: Array.isArray(snapshot.approaches)
      ? snapshot.approaches
      : [],

    approaches: approachLabels,

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

    snapshotBeforeReturn: await normalizeSnapshot(
  data.snapshotBeforeReturn || {}
),
  };
}