import { db } from "../../../config/firebase.js";

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

function normalizePhoto(photo) {
  if (!photo) return null;

  if (typeof photo === "string") {
    return {
      url: photo,
      imageUrl: photo,
      fullUrl: photo,
    };
  }

  const url =
    photo.url ||
    photo.downloadURL ||
    photo.imageUrl ||
    photo.uri ||
    photo.fullUrl ||
    null;

  if (!url) return null;

  return {
    ...photo,
    url,
    imageUrl: url,
    fullUrl: photo.fullUrl || url,
  };
}

function getPhotos(data) {
  const rawPhotos = data.photos || data.images || data.photoUrls || [];

  if (!Array.isArray(rawPhotos)) {
    return [];
  }

  return rawPhotos.map(normalizePhoto).filter(Boolean);
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

  return {
    id: data.placeSubmissionId || doc.id,
    placeSubmissionId: data.placeSubmissionId || doc.id,

    name: data.name || "Lugar sin nombre",
    description: data.description || "",
    price: data.price || null,

    tagId: data.tagId || null,
    tag: data.tagLabel || "Sin categoría",
    tagLabel: data.tagLabel || "Sin categoría",

    subtags: Array.isArray(data.subtags) ? data.subtags : [],

    status: data.status || "in_review",
    source: data.source || null,

    imageUrl: photos[0]?.imageUrl || null,
    photos,

    coordinates,

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