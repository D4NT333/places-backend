import { db, FieldValue } from "../../../config/firebase.js";

const DEFAULT_OPENING_HOURS = {
  type: "not_specified",
  days: [],
  openTime: null,
  closeTime: null,
  label: "Horario no especificado",
};

const RETURN_FIELD_KEYS = [
  "name",
  "description",
  "location",
  "photos",
  "tag",
  "subtags",
  "approaches",
  "price",
  "schedule",
];

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

function getPhotoUrl(photo) {
  if (!photo) return "";

  if (typeof photo === "string") return photo;

  return (
    photo.url ||
    photo.displayUrl ||
    photo.thumbnailUrl ||
    photo.thumbnail?.url ||
    photo.mediumUrl ||
    photo.medium?.url ||
    photo.originalUrl ||
    photo.original?.url ||
    photo.thumbnailURL ||
    photo.mediumURL ||
    photo.downloadURL ||
    photo.uri ||
    photo.src ||
    ""
  );
}

function normalizePhotoItems(photoItems = []) {
  if (!Array.isArray(photoItems)) return [];

  return photoItems.map((photo, index) => ({
    index: typeof photo.index === "number" ? photo.index : index,

    url: getPhotoUrl(photo),

    selected: Boolean(photo.selected),

    message:
      typeof photo.message === "string" ? photo.message.trim() : "",
  }));
}

function normalizeReturnFields(fields = {}) {
  const normalized = {};

  RETURN_FIELD_KEYS.forEach((fieldKey) => {
    const field = fields[fieldKey] || {};

    if (fieldKey === "photos") {
      const items = normalizePhotoItems(field.items);

      normalized.photos = {
        selected: items.some((photo) => photo.selected),
        message: typeof field.message === "string" ? field.message.trim() : "",
        items,
      };

      return;
    }

    normalized[fieldKey] = {
      selected: Boolean(field.selected),
      message: typeof field.message === "string" ? field.message.trim() : "",
    };
  });

  return normalized;
}

function normalizeSnapshotPhotos(photos = []) {
  if (!Array.isArray(photos)) return [];

  return photos.map((photo, index) => {
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
        displayUrl: photo,
        mediumUrl: photo,
        thumbnailUrl: photo,
        originalUrl: photo,
      };
    }

    const originalUrl =
      photo.original?.url ||
      photo.originalUrl ||
      photo.downloadURL ||
      photo.url ||
      null;

    const mediumUrl =
      photo.medium?.url ||
      photo.mediumUrl ||
      photo.mediumURL ||
      originalUrl ||
      null;

    const thumbnailUrl =
      photo.thumbnail?.url ||
      photo.thumbnailUrl ||
      photo.thumbnailURL ||
      mediumUrl ||
      originalUrl ||
      null;

    return {
      photoId: photo.photoId || `photo_${index + 1}`,

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

      displayUrl: mediumUrl || originalUrl || thumbnailUrl,
      mediumUrl,
      thumbnailUrl,
      originalUrl,
    };
  });
}

function buildSnapshotBeforeReturn(submissionData = {}) {
  const openingHours = normalizeOpeningHours(submissionData.openingHours);

  return {
    name: submissionData.name || "",
    description: submissionData.description || "",
    location: submissionData.location || null,

    tagId: submissionData.tagId || null,
    tagLabel: submissionData.tagLabel || null,

    subtags: Array.isArray(submissionData.subtags)
      ? submissionData.subtags
      : [],

    approaches: Array.isArray(submissionData.approaches)
      ? submissionData.approaches
      : Array.isArray(submissionData.approach)
        ? submissionData.approach
        : Array.isArray(submissionData.focuses)
          ? submissionData.focuses
          : [],

    price: submissionData.price || null,

    openingHours,

    // Alias para comparación vieja en frontend.
    schedule: openingHours.label,

    photos: normalizeSnapshotPhotos(submissionData.photos),
  };
}

export default async function returnPlaceSubmissionService({
  submissionId,
  returnedBy = "admin_panel",
  generalMessage = "",
  fields = {},
}) {
  if (!submissionId) {
    throw new Error("Falta submissionId para devolver la propuesta.");
  }

  const submissionRef = db.collection("placeSubmissions").doc(submissionId);
  const submissionSnap = await submissionRef.get();

  if (!submissionSnap.exists) {
    const error = new Error("La propuesta no existe.");
    error.statusCode = 404;
    throw error;
  }

  const submissionData = submissionSnap.data();

  const returnId = `return_${submissionId}_${Date.now()}`;
  const returnRef = db.collection("placeSubmissionReturns").doc(returnId);

  const normalizedFields = normalizeReturnFields(fields);
  const snapshotBeforeReturn = buildSnapshotBeforeReturn(submissionData);

  const returnPayload = {
    returnId,
    submissionId,

    createdBy: submissionData.createdBy || null,
    returnedBy,

    returnedAt: FieldValue.serverTimestamp(),

    generalMessage:
      typeof generalMessage === "string" ? generalMessage.trim() : "",

    fields: normalizedFields,

    snapshotBeforeReturn,

    resolved: false,
    resolvedAt: null,
  };

  const batch = db.batch();

  batch.set(returnRef, returnPayload);

  batch.update(submissionRef, {
    status: "returned",
    currentReturnId: returnId,
    returnedAt: FieldValue.serverTimestamp(),
    returnedBy,

    // Guardamos también estos campos en la submission para fácil lectura.
    returnFields: normalizedFields,
    snapshotBeforeReturn,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return {
    returnId,
    submissionId,
    status: "returned",
  };
}