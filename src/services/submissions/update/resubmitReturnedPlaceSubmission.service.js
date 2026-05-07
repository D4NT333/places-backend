import { db, FieldValue } from "../../../config/firebase.js";

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLocation(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw createHttpError("Ubicación inválida.", 400);
  }

  return {
    latitude,
    longitude,
  };
}

function applyPhotoCorrections(currentPhotos = [], photoCorrections = []) {
  const nextPhotos = Array.isArray(currentPhotos) ? [...currentPhotos] : [];

  if (!Array.isArray(photoCorrections)) {
    return nextPhotos;
  }

  photoCorrections.forEach((correction) => {
    const photoIndex = Number(correction?.photoIndex);
    const nextPhoto = correction?.photo;

    if (!Number.isInteger(photoIndex) || photoIndex < 0) {
      return;
    }

    if (!nextPhoto || typeof nextPhoto !== "object") {
      return;
    }

    nextPhotos[photoIndex] = {
      ...nextPhoto,
      replacedPhotoIndex: photoIndex,
      replacedOldPhotoId: correction.oldPhotoId || null,
    };
  });

  return nextPhotos;
}

function buildSubmissionUpdateData({ correctedFields, submissionData }) {
  const updateData = {};

  if (hasOwn(correctedFields, "name")) {
    const name = cleanText(correctedFields.name);

    if (name.length < 3) {
      throw createHttpError("El nombre corregido es demasiado corto.", 400);
    }

    updateData.name = name;
  }

  if (hasOwn(correctedFields, "description")) {
    const description = cleanText(correctedFields.description);

    if (description.length < 80) {
      throw createHttpError("La descripción corregida es demasiado corta.", 400);
    }

    updateData.description = description;
  }

  if (hasOwn(correctedFields, "tag")) {
    const tagId = cleanText(correctedFields.tag?.tagId);
    const tagLabel = cleanText(correctedFields.tag?.label);

    if (!tagId || !tagLabel) {
      throw createHttpError("Etiqueta inválida.", 400);
    }

    updateData.tagId = tagId;
    updateData.tagLabel = tagLabel;
  }

  if (hasOwn(correctedFields, "subtags")) {
    const subtags = cleanStringArray(correctedFields.subtags);

    if (subtags.length === 0) {
      throw createHttpError("Debes enviar al menos una subetiqueta.", 400);
    }

    updateData.subtags = subtags;
  }

  if (hasOwn(correctedFields, "approaches")) {
    if (correctedFields.approaches === null) {
      updateData.approaches = null;
    } else {
      const approaches = cleanStringArray(correctedFields.approaches);

      if (approaches.length === 0) {
        throw createHttpError("Enfoque inválido.", 400);
      }

      updateData.approaches = approaches;
    }
  }

  if (hasOwn(correctedFields, "price")) {
    const price = cleanText(correctedFields.price);

    if (!price) {
      throw createHttpError("Rango de precio inválido.", 400);
    }

    updateData.price = price;
  }

  if (hasOwn(correctedFields, "schedule")) {
    updateData.schedule = cleanText(correctedFields.schedule);
  }

  if (hasOwn(correctedFields, "location")) {
    updateData.location = normalizeLocation(correctedFields.location);
  }

  if (hasOwn(correctedFields, "photos")) {
    updateData.photos = applyPhotoCorrections(
      submissionData.photos,
      correctedFields.photos
    );
  }

  return updateData;
}

async function findActiveReturnDoc({ submissionId, returnId }) {
  const returnsRef = db.collection("placeSubmissionReturns");

  if (returnId) {
    const byReturnIdSnap = await returnsRef
      .where("submissionId", "==", submissionId)
      .where("returnId", "==", returnId)
      .limit(1)
      .get();

    if (!byReturnIdSnap.empty) {
      return byReturnIdSnap.docs[0];
    }
  }

  const activeReturnSnap = await returnsRef
    .where("submissionId", "==", submissionId)
    .where("resolved", "==", false)
    .limit(1)
    .get();

  if (activeReturnSnap.empty) {
    return null;
  }

  return activeReturnSnap.docs[0];
}

export default async function resubmitReturnedPlaceSubmissionService({
  submissionId,
  uid,
  payload,
}) {
  if (!submissionId) {
    throw createHttpError("Falta submissionId.", 400);
  }

  if (!uid) {
    throw createHttpError("Usuario no autenticado.", 401);
  }

  const returnId = payload?.returnId || null;
  const correctedFields = payload?.correctedFields || {};

  if (!returnId) {
    throw createHttpError("Falta returnId.", 400);
  }

  const correctedFieldKeys = Object.keys(correctedFields);

  if (correctedFieldKeys.length === 0) {
    throw createHttpError("No llegaron campos corregidos.", 400);
  }

  const submissionRef = db.collection("placeSubmissions").doc(submissionId);
  const submissionSnap = await submissionRef.get();

  if (!submissionSnap.exists) {
    throw createHttpError("La propuesta no existe.", 404);
  }

  const submissionData = submissionSnap.data();

  if (submissionData.createdBy !== uid) {
    throw createHttpError("No puedes reenviar esta propuesta.", 403);
  }

  if (submissionData.status !== "returned") {
    throw createHttpError("Solo puedes reenviar propuestas devueltas.", 400);
  }

  const activeReturnDoc = await findActiveReturnDoc({
    submissionId,
    returnId,
  });

  if (!activeReturnDoc) {
    throw createHttpError("No se encontró una devolución activa.", 404);
  }

  const updateData = buildSubmissionUpdateData({
    correctedFields,
    submissionData,
  });

  if (Object.keys(updateData).length === 0) {
    throw createHttpError("No hay datos válidos para actualizar.", 400);
  }

  const now = FieldValue.serverTimestamp();

  const batch = db.batch();

  batch.update(submissionRef, {
    ...updateData,

    status: "resubmitted",
    updatedAt: now,
    resubmittedAt: now,
    lastReturnId: returnId,
    lastResubmittedBy: uid,

    reviewHistory: FieldValue.arrayUnion({
      type: "resubmitted",
      by: uid,
      at: new Date().toISOString(),
      returnId,
      correctedFieldKeys,
    }),
  });

  batch.update(activeReturnDoc.ref, {
    resolved: true,
    resolvedAt: now,
    resolvedBy: uid,
  });

  await batch.commit();

  return {
    submissionId,
    returnId,
    status: "resubmitted",
    updatedFields: Object.keys(updateData),
    correctedFieldKeys,
  };
}