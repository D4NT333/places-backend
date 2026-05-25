import { db } from "../../../config/firebase.js";

const DEFAULT_OPENING_HOURS = {
  type: "not_specified",
  days: [],
  openTime: null,
  closeTime: null,
  label: "Horario no especificado",
};

function formatTimestamp(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function getTimestampMs(value) {
  if (!value) return 0;

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeOpeningHours(openingHours, fallbackSchedule = "") {
  if (!openingHours || typeof openingHours !== "object") {
    return {
      ...DEFAULT_OPENING_HOURS,
      label: fallbackSchedule || DEFAULT_OPENING_HOURS.label,
    };
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

  if (type === "defined") {
    return {
      type: "defined",
      days: Array.isArray(openingHours.days) ? openingHours.days : [],
      openTime: openingHours.openTime || "09:00",
      closeTime: openingHours.closeTime || "18:00",
      label: openingHours.label || fallbackSchedule || "Horario definido",
    };
  }

  return {
    type: "not_specified",
    days: [],
    openTime: null,
    closeTime: null,
    label:
      openingHours.label ||
      fallbackSchedule ||
      "Horario no especificado",
  };
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

function normalizePhoto(photo = {}, index = 0) {
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

      url: displayUrl,
      imageUrl: displayUrl,
      fullUrl: originalUrl || displayUrl,
      previewURL,

      originalUrl: originalUrl || displayUrl,
      mediumUrl: mediumUrl || displayUrl,
      thumbnailUrl: thumbnailUrl || displayUrl,
      displayUrl,

      original: {
        url: originalUrl || displayUrl,
        path: null,
        fileName: null,
        width: null,
        height: null,
        size: null,
        mimeType: null,
      },

      medium: {
        url: mediumUrl || displayUrl,
        path: null,
        fileName: null,
        width: null,
        height: null,
        mimeType: null,
      },

      thumbnail: {
        url: thumbnailUrl || displayUrl,
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

    photoId: photo.photoId || photo.id || `photo_${index + 1}`,

    url: displayUrl,
    imageUrl: displayUrl,
    fullUrl: originalUrl || displayUrl,
    previewURL,

    originalUrl,
    mediumUrl,
    thumbnailUrl,
    displayUrl,

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
  };
}

function normalizePhotos(photos = []) {
  if (!Array.isArray(photos)) return [];

  return photos
    .map((photo, index) => normalizePhoto(photo, index))
    .filter(Boolean);
}

function normalizeSubmission({ id, data }) {
  const openingHours = normalizeOpeningHours(
    data.openingHours,
    data.schedule
  );

  return {
    id,

    createdBy: data.createdBy || null,
    status: data.status || "in_review",

    name: data.name || "",
    description: data.description || "",

    tagId: data.tagId || null,
    tagLabel: data.tagLabel || data.tag || null,

    subtags: Array.isArray(data.subtags) ? data.subtags : [],
    approaches: Array.isArray(data.approaches)
      ? data.approaches
      : Array.isArray(data.approach)
        ? data.approach
        : Array.isArray(data.focuses)
          ? data.focuses
          : [],

    price: data.price || data.priceLabel || "",

    openingHours,
    schedule: openingHours.label,

    location: data.location || data.coordinates || null,

    photos: normalizePhotos(data.photos),

    reviewCycle: data.reviewCycle || 0,
    wasReturnedBefore: Boolean(data.wasReturnedBefore),

    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
    returnedAt: formatTimestamp(data.returnedAt),
    resubmittedAt: formatTimestamp(data.resubmittedAt),
  };
}

function normalizePhotoReturnItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    index: typeof item.index === "number" ? item.index : index,
    url: getPhotoUrl(item, "thumbnail") || item.url || "",
    selected: Boolean(item.selected),
    message: item.message || "",
  }));
}

function normalizeSubtagReturnItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => ({
    index: typeof item.index === "number" ? item.index : index,

    label:
      typeof item.label === "string"
        ? item.label
        : typeof item.name === "string"
          ? item.name
          : typeof item.value === "string"
            ? item.value
            : "",

    selected: Boolean(item.selected),

    message: typeof item.message === "string" ? item.message : "",
  }));
}

function normalizeReturnFields(returnData = {}) {
  const fields =
    returnData.fields ||
    returnData.returnFields ||
    returnData.requestedFields ||
    {};

  return {
    name: {
      selected: Boolean(fields.name?.selected),
      message: fields.name?.message || "",
    },
    description: {
      selected: Boolean(fields.description?.selected),
      message: fields.description?.message || "",
    },
    tag: {
      selected: Boolean(fields.tag?.selected),
      message: fields.tag?.message || "",
    },
    subtags: {
  selected: Boolean(fields.subtags?.selected),
  message: fields.subtags?.message || "",
  items: normalizeSubtagReturnItems(fields.subtags?.items),
},
    approaches: {
      selected: Boolean(fields.approaches?.selected),
      message: fields.approaches?.message || "",
    },
    price: {
      selected: Boolean(fields.price?.selected),
      message: fields.price?.message || "",
    },
    schedule: {
      selected: Boolean(fields.schedule?.selected),
      message: fields.schedule?.message || "",
    },
    photos: {
      selected: Boolean(fields.photos?.selected),
      message: fields.photos?.message || "",
      items: normalizePhotoReturnItems(fields.photos?.items),
    },
    location: {
      selected: Boolean(fields.location?.selected),
      message: fields.location?.message || "",
    },
  };
}

function normalizeSnapshot(snapshot = {}) {
  const openingHours = normalizeOpeningHours(
    snapshot.openingHours,
    snapshot.schedule
  );

  return {
    name: snapshot.name || "",
    description: snapshot.description || "",

    tagId: snapshot.tagId || null,
    tagLabel: snapshot.tagLabel || snapshot.tag || null,

    subtags: Array.isArray(snapshot.subtags) ? snapshot.subtags : [],
    approaches: Array.isArray(snapshot.approaches)
      ? snapshot.approaches
      : Array.isArray(snapshot.approach)
        ? snapshot.approach
        : Array.isArray(snapshot.focuses)
          ? snapshot.focuses
          : [],

    price: snapshot.price || snapshot.priceLabel || "",

    openingHours,
    schedule: openingHours.label,

    location: snapshot.location || snapshot.coordinates || null,

    photos: normalizePhotos(snapshot.photos),
  };
}

function normalizeReturn({ id, data }) {
  const snapshotBeforeReturn = normalizeSnapshot(data.snapshotBeforeReturn || {});

  return {
    id,
    returnId: data.returnId || id,

    submissionId: data.submissionId || null,

    generalMessage: data.generalMessage || "",
    returnedBy: data.returnedBy || null,

    resolved: Boolean(data.resolved),
    resolvedAt: formatTimestamp(data.resolvedAt),
    returnedAt: formatTimestamp(data.returnedAt),

    fields: normalizeReturnFields(data),
    returnFields: normalizeReturnFields(data),

    snapshotBeforeReturn,
  };
}

async function getLatestActiveReturnBySubmissionId(submissionId) {
  const snapshot = await db
    .collection("placeSubmissionReturns")
    .where("submissionId", "==", submissionId)
    .where("resolved", "==", false)
    .get();

  if (snapshot.empty) return null;

  const docs = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }))
    .sort(
      (a, b) =>
        getTimestampMs(b.data.returnedAt) - getTimestampMs(a.data.returnedAt)
    );

  const latestReturn = docs[0];

  return normalizeReturn({
    id: latestReturn.id,
    data: latestReturn.data,
  });
}

export default async function getReturnedPlaceSubmissionEditDataService({
  submissionId,
  requesterUid,
}) {
  if (!submissionId) {
    const error = new Error("Falta submissionId.");
    error.statusCode = 400;
    throw error;
  }

  const submissionRef = db.collection("placeSubmissions").doc(submissionId);
  const submissionDoc = await submissionRef.get();

  if (!submissionDoc.exists) {
    const error = new Error("No se encontró la propuesta.");
    error.statusCode = 404;
    throw error;
  }

  const submissionData = submissionDoc.data();

  if (
    requesterUid &&
    submissionData.createdBy &&
    submissionData.createdBy !== requesterUid
  ) {
    const error = new Error("No tienes permiso para editar esta propuesta.");
    error.statusCode = 403;
    throw error;
  }

  const submission = normalizeSubmission({
    id: submissionDoc.id,
    data: submissionData,
  });

  const activeReturn = await getLatestActiveReturnBySubmissionId(submissionId);

  return {
    submissionId,
    submission,
    activeReturn,

    currentData: submission,

    returnData: activeReturn,

    snapshotBeforeReturn: activeReturn?.snapshotBeforeReturn || null,

    returnFields: activeReturn?.fields || null,
  };
}