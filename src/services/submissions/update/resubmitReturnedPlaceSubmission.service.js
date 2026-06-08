import { db, FieldValue } from "../../../config/firebase.js";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 6;

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

function normalizeOpeningHours(value) {
  if (!value || typeof value !== "object") {
    throw createHttpError("Horario inválido.", 400);
  }

  const validTypes = ["defined", "always_open"];

  if (!validTypes.includes(value.type)) {
    throw createHttpError("Tipo de horario inválido.", 400);
  }

  if (value.type === "always_open") {
    return {
      type: "always_open",
      days: [],
      openTime: null,
      closeTime: null,
      label: "Abierto 24 horas",
    };
  }

  const days = cleanStringArray(value.days);
  const openTime = cleanText(value.openTime);
  const closeTime = cleanText(value.closeTime);
  const label = cleanText(value.label);

  if (days.length === 0) {
    throw createHttpError("Debes seleccionar al menos un día.", 400);
  }

  if (!openTime || !closeTime) {
    throw createHttpError("Debes seleccionar hora de apertura y cierre.", 400);
  }

  if (openTime === closeTime) {
    throw createHttpError(
      "La hora de apertura y cierre no puede ser igual.",
      400
    );
  }

  return {
    type: "defined",
    days,
    openTime,
    closeTime,
    label: label || `${days.join(", ")} · ${openTime} - ${closeTime}`,
  };
}

function applyPhotoCorrections(currentPhotos = [], photoCorrections = []) {
  const basePhotos = Array.isArray(currentPhotos) ? [...currentPhotos] : [];

  if (!Array.isArray(photoCorrections) || photoCorrections.length === 0) {
    return basePhotos;
  }

  const deletedIndexes = new Set();
  const replacedPhotosByIndex = new Map();
  const addedPhotos = [];

  photoCorrections.forEach((correction) => {
    const type = correction?.type;
    const photoIndex = Number(correction?.photoIndex);

    if (type === "delete" || type === "replace") {
      if (!Number.isInteger(photoIndex) || photoIndex < 0) {
        return;
      }

      if (photoIndex >= basePhotos.length) {
        return;
      }
    }

    if (type === "delete") {
      deletedIndexes.add(photoIndex);
      replacedPhotosByIndex.delete(photoIndex);
      return;
    }

    if (type === "replace") {
      const nextPhoto = correction?.photo;

      if (!nextPhoto || typeof nextPhoto !== "object") {
        return;
      }

      replacedPhotosByIndex.set(photoIndex, {
        ...nextPhoto,
        replacedPhotoIndex: photoIndex,
        replacedOldPhotoId: correction.oldPhotoId || null,
      });

      return;
    }

    if (type === "add") {
      const nextPhoto = correction?.photo;

      if (!nextPhoto || typeof nextPhoto !== "object") {
        return;
      }

      addedPhotos.push({
        photoIndex: Number.isInteger(photoIndex) ? photoIndex : 9999,
        photo: {
          ...nextPhoto,
          addedPhotoIndex: Number.isInteger(photoIndex) ? photoIndex : null,
          addedTempPhotoId: correction.tempPhotoId || null,
        },
      });
    }
  });

  const correctedBasePhotos = basePhotos
    .map((photo, index) => {
      if (deletedIndexes.has(index)) {
        return null;
      }

      if (replacedPhotosByIndex.has(index)) {
        return replacedPhotosByIndex.get(index);
      }

      return photo;
    })
    .filter(Boolean);

  const sortedAddedPhotos = addedPhotos
    .sort((a, b) => a.photoIndex - b.photoIndex)
    .map((item) => item.photo);

  return [...correctedBasePhotos, ...sortedAddedPhotos];
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

  /**
   * Modelo nuevo:
   * correctedFields.openingHours llega como map/object desde el front.
   */
  if (hasOwn(correctedFields, "openingHours")) {
    const openingHours = normalizeOpeningHours(correctedFields.openingHours);

    updateData.openingHours = openingHours;

    // Alias temporal para pantallas viejas que todavía lean submission.schedule.
    updateData.schedule = openingHours.label;
  }

  /**
   * Compatibilidad vieja:
   * si alguna app todavía manda schedule como string, no truena.
   * Pero el modelo bueno sigue siendo openingHours.
   */
  if (
    hasOwn(correctedFields, "schedule") &&
    !hasOwn(correctedFields, "openingHours")
  ) {
    const schedule = cleanText(correctedFields.schedule);

    if (!schedule) {
      throw createHttpError("Horario inválido.", 400);
    }

    updateData.openingHours = {
      type: "not_specified",
      days: [],
      openTime: null,
      closeTime: null,
      label: schedule,
    };

    updateData.schedule = schedule;
  }

  if (hasOwn(correctedFields, "location")) {
    updateData.location = normalizeLocation(correctedFields.location);
  }

 if (hasOwn(correctedFields, "photos")) {
  const nextPhotos = applyPhotoCorrections(
    submissionData.photos,
    correctedFields.photos
  );

  if (nextPhotos.length < MIN_PHOTOS) {
    throw createHttpError(
      `La propuesta debe conservar al menos ${MIN_PHOTOS} fotos.`,
      400
    );
  }

  if (nextPhotos.length > MAX_PHOTOS) {
    throw createHttpError(
      `La propuesta no puede tener más de ${MAX_PHOTOS} fotos.`,
      400
    );
  }

  updateData.photos = nextPhotos;
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