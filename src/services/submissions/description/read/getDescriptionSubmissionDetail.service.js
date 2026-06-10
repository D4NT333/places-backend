import { db } from "../../../../config/firebase.js";

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeTimestamp(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function normalizeUser(createdBy = {}) {
  return {
    uid: createdBy.uid || null,
    name: createdBy.name || "Usuario desconocido",
    email: createdBy.email || null,
    picture: createdBy.picture || createdBy.photoURL || null,
  };
}

async function getCatalogLabel(collectionName, docId) {
  if (!docId || typeof docId !== "string") return null;

  try {
    const docSnap = await db.collection(collectionName).doc(docId).get();

    if (!docSnap.exists) return null;

    const data = docSnap.data();

    return data.label || data.name || data.title || data.value || null;
  } catch (error) {
    console.error(`Error leyendo catálogo ${collectionName}/${docId}:`, error);
    return null;
  }
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

async function normalizeTags(submissionData) {
  const placeSnapshot = submissionData.placeSnapshot || {};

  const tagId = submissionData.tagId || placeSnapshot.tagId || null;

  let tagLabel = submissionData.tagLabel || placeSnapshot.tagLabel || null;

  if (!tagLabel && tagId) {
    tagLabel = await getCatalogLabel("tag", tagId);
  }

  const subtagIds = ensureArray(
    submissionData.subtags || placeSnapshot.subtags
  );

  const approachIds = ensureArray(
    submissionData.approaches || placeSnapshot.approaches
  );

  const subtags = await Promise.all(
    subtagIds.map(async (subtagId) => {
      const label = await getCatalogLabel("subtag", subtagId);

      return {
        id: subtagId,
        label: label || subtagId,
      };
    })
  );

  const approaches = await Promise.all(
    approachIds.map(async (approachId) => {
      const label = await getCatalogLabel("approach", approachId);

      return {
        id: approachId,
        label: label || approachId,
      };
    })
  );

  return {
    tag: tagId
      ? {
          id: tagId,
          label: tagLabel || tagId,
        }
      : null,

    subtags,
    approaches,
  };
}

async function getDescriptionSubmissionDetailService(submissionId) {
  if (!submissionId) {
    throw createHttpError(400, "El id de la propuesta es obligatorio.");
  }

  const submissionSnap = await db
    .collection("descriptionSubmissions")
    .doc(submissionId)
    .get();

  if (!submissionSnap.exists) {
    throw createHttpError(404, "No se encontró la propuesta de descripción.");
  }

  const submissionData = submissionSnap.data();

  if (submissionData.deletedAt) {
    throw createHttpError(
      404,
      "La propuesta de descripción ya no está disponible."
    );
  }

  const placeSnapshot = submissionData.placeSnapshot || {};

  const placeId =
    submissionData.placeId ||
    submissionData.placeDocId ||
    placeSnapshot.placeId ||
    null;

  const tags = await normalizeTags(submissionData);

  return {
    id: submissionSnap.id,
    submissionId: submissionData.submissionId || submissionSnap.id,

    type: submissionData.type || "description",
    status: submissionData.status || "in_review",

    placeId,
    placeDocId: submissionData.placeDocId || placeId,

    placeName:
      submissionData.placeName ||
      placeSnapshot.name ||
      "Lugar sin nombre",

    source: submissionData.source || null,

    createdBy: normalizeUser(submissionData.createdBy),

    createdAt: normalizeTimestamp(submissionData.createdAt),
    updatedAt: normalizeTimestamp(submissionData.updatedAt),

    reviewedAt: normalizeTimestamp(submissionData.reviewedAt),
    reviewedBy: submissionData.reviewedBy || null,
    reviewMessage: submissionData.reviewMessage || null,

    currentDescription: submissionData.currentDescription || "",
    proposedDescription: submissionData.proposedDescription || "",

    placeSnapshot: {
      name:
        placeSnapshot.name ||
        submissionData.placeName ||
        "Lugar sin nombre",

      address: placeSnapshot.address || null,
      mainPhoto: placeSnapshot.mainPhoto || null,
    },

    tag: tags.tag,
    subtags: tags.subtags,
    approaches: tags.approaches,
  };
}

export default getDescriptionSubmissionDetailService;