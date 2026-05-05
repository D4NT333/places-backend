import { db, FieldValue } from "../../../config/firebase.js";

const RETURN_FIELD_KEYS = [
  "name",
  "description",
  "location",
  "photos",
  "tag",
  "subtags",
  "approaches",
  "price",
];

function normalizePhotoItems(photoItems = []) {
  if (!Array.isArray(photoItems)) return [];

  return photoItems.map((photo, index) => ({
    index: typeof photo.index === "number" ? photo.index : index,

    url: typeof photo.url === "string" ? photo.url : "",

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

function buildSnapshotBeforeReturn(submissionData = {}) {
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

    photos: Array.isArray(submissionData.photos)
      ? submissionData.photos
      : [],
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

    statusBeforeReturn: submissionData.status || null,

    resolved: false,
    resolvedAt: null,
    changedFields: [],
  };

  const batch = db.batch();

  batch.set(returnRef, returnPayload);

  batch.update(submissionRef, {
    status: "returned",
    currentReturnId: returnId,
    returnedAt: FieldValue.serverTimestamp(),
    returnedBy,
  });

  await batch.commit();

  return {
    returnId,
    submissionId,
    status: "returned",
  };
}