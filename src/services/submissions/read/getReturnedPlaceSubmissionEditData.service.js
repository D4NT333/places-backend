import { db } from "../../../config/firebase.js";

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

function normalizePhoto(photo = {}) {
  if (typeof photo === "string") {
    return {
      url: photo,
      downloadURL: photo,
      mediumURL: photo,
      thumbnailURL: photo,
    };
  }

  return {
    ...photo,

    // URL preferida para vistas pesadas.
    url:
      photo.mediumURL ||
      photo.downloadURL ||
      photo.url ||
      photo.imageUrl ||
      photo.uri ||
      photo.thumbnailURL ||
      null,

    // URL preferida para previews.
    previewURL:
      photo.thumbnailURL ||
      photo.mediumURL ||
      photo.downloadURL ||
      photo.url ||
      photo.imageUrl ||
      photo.uri ||
      null,
  };
}

function normalizeSubmission({ id, data }) {
  return {
    id,

    createdBy: data.createdBy || null,
    status: data.status || "in_review",

    name: data.name || "",
    description: data.description || "",

    tagId: data.tagId || null,
    tagLabel: data.tagLabel || data.tag || null,

    subtags: Array.isArray(data.subtags) ? data.subtags : [],
    approaches: Array.isArray(data.approaches) ? data.approaches : [],

    price: data.price || data.priceLabel || "",

    location: data.location || data.coordinates || null,

    photos: Array.isArray(data.photos)
      ? data.photos.map(normalizePhoto)
      : [],

    reviewCycle: data.reviewCycle || 0,
    wasReturnedBefore: Boolean(data.wasReturnedBefore),

    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
    returnedAt: formatTimestamp(data.returnedAt),
    resubmittedAt: formatTimestamp(data.resubmittedAt),
  };
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
    },
    location: {
      selected: Boolean(fields.location?.selected),
      message: fields.location?.message || "",
    },
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

    price: snapshot.price || snapshot.priceLabel || "",

    location: snapshot.location || snapshot.coordinates || null,

    photos: Array.isArray(snapshot.photos)
      ? snapshot.photos.map(normalizePhoto)
      : [],
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

    statusBeforeReturn: data.statusBeforeReturn || null,

    fields: normalizeReturnFields(data),
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

    snapshotBeforeReturn:
      activeReturn?.snapshotBeforeReturn || null,

    returnFields:
      activeReturn?.fields || null,
  };
}