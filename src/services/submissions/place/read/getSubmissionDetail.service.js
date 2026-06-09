import { db } from "../../../../config/firebase.js";

const DEFAULT_OPENING_HOURS = {
  type: "not_specified",
  days: [],
  openTime: null,
  closeTime: null,
  label: "Horario no especificado",
};

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return null;
  }

  return timestamp.toDate().toISOString();
}

function mapUserDisplayName(user) {
  if (!user) {
    return "Usuario desconocido";
  }

  return (
    user.name ||
    user.displayName ||
    user.username ||
    user.email ||
    "Usuario desconocido"
  );
}

function mapUserPhotoUrl(user) {
  if (!user) {
    return null;
  }

  return user.photoURL || user.photoUrl || user.avatarUrl || null;
}

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

function getPhotoUrl(photo, preferredSize = "medium") {
  if (!photo) return null;

  if (preferredSize === "thumbnail") {
    return (
      photo.thumbnail?.url ||
      photo.thumbnailURL ||
      photo.medium?.url ||
      photo.mediumURL ||
      photo.original?.url ||
      photo.downloadURL ||
      null
    );
  }

  if (preferredSize === "original") {
    return (
      photo.original?.url ||
      photo.downloadURL ||
      photo.medium?.url ||
      photo.mediumURL ||
      photo.thumbnail?.url ||
      photo.thumbnailURL ||
      null
    );
  }

  return (
    photo.medium?.url ||
    photo.mediumURL ||
    photo.original?.url ||
    photo.downloadURL ||
    photo.thumbnail?.url ||
    photo.thumbnailURL ||
    null
  );
}

function normalizePhoto(photo, index) {
  if (!photo) return null;

  const originalUrl = getPhotoUrl(photo, "original");
  const mediumUrl = getPhotoUrl(photo, "medium");
  const thumbnailUrl = getPhotoUrl(photo, "thumbnail");

  if (!originalUrl && !mediumUrl && !thumbnailUrl) {
    return null;
  }

  return {
    photoId: photo.photoId || `photo_${index + 1}`,

    original: {
      url: photo.original?.url || photo.downloadURL || originalUrl,
      path: photo.original?.path || photo.storagePath || null,
      fileName: photo.original?.fileName || photo.fileName || null,
      width: photo.original?.width ?? photo.width ?? null,
      height: photo.original?.height ?? photo.height ?? null,
      size: photo.original?.size ?? photo.fileSize ?? null,
      mimeType: photo.original?.mimeType || photo.mimeType || null,
    },

    medium: {
      url: photo.medium?.url || photo.mediumURL || mediumUrl,
      path: photo.medium?.path || photo.mediumPath || null,
      fileName: photo.medium?.fileName || photo.mediumFileName || null,
      width: photo.medium?.width ?? photo.mediumWidth ?? null,
      height: photo.medium?.height ?? photo.mediumHeight ?? null,
      mimeType: photo.medium?.mimeType || "image/jpeg",
    },

    thumbnail: {
      url: photo.thumbnail?.url || photo.thumbnailURL || thumbnailUrl,
      path: photo.thumbnail?.path || photo.thumbnailPath || null,
      fileName: photo.thumbnail?.fileName || photo.thumbnailFileName || null,
      width: photo.thumbnail?.width ?? photo.thumbnailWidth ?? null,
      height: photo.thumbnail?.height ?? photo.thumbnailHeight ?? null,
      mimeType: photo.thumbnail?.mimeType || "image/jpeg",
    },

    source: photo.source || "user",
    uploadedAt: photo.uploadedAt || null,

    originalUrl,
    mediumUrl,
    thumbnailUrl,
    displayUrl: mediumUrl || originalUrl || thumbnailUrl,
  };
}

function normalizePhotos(photos = []) {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos
    .map((photo, index) => normalizePhoto(photo, index))
    .filter(Boolean);
}

export default async function getSubmissionDetailService({ submissionId }) {
  if (!submissionId) {
    throw new Error("ID de submission no proporcionado.");
  }

  console.log("========== GET SUBMISSION DETAIL SERVICE ==========");
  console.log("Submission ID recibido:", submissionId);

  const submissionSnapshot = await db
    .collection("placeSubmissions")
    .doc(submissionId)
    .get();

  if (!submissionSnapshot.exists) {
    throw new Error("La submission no existe.");
  }

  const submission = {
    id: submissionSnapshot.id,
    ...submissionSnapshot.data(),
  };

  let user = null;

  if (submission.createdBy) {
    const userSnapshot = await db
      .collection("user")
      .doc(submission.createdBy)
      .get();

    if (userSnapshot.exists) {
      user = {
        id: userSnapshot.id,
        ...userSnapshot.data(),
      };
    }
  }

  const photos = normalizePhotos(submission.photos);
  const openingHours = normalizeOpeningHours(submission.openingHours);

  console.log("Submission encontrada:", submission.id);
  console.log("Usuario encontrado:", user?.id || null);
  console.log("Fotos normalizadas:", photos.length);
  console.log("Horario normalizado:", openingHours);
  console.log("===================================================");

  return {
    id: submission.id,
    placeSubmissionId: submission.placeSubmissionId || submission.id,

    name: submission.name || "Lugar sin nombre",
    description: submission.description || "",
    status: submission.status || "unknown",

    createdAt: formatTimestamp(submission.createdAt),
    updatedAt: formatTimestamp(submission.updatedAt),

    userId: submission.createdBy || null,
    userName: mapUserDisplayName(user),
    userPhotoUrl: mapUserPhotoUrl(user),

    photos,
    coverPhotoUrl:
      photos[0]?.mediumUrl ||
      photos[0]?.originalUrl ||
      photos[0]?.thumbnailUrl ||
      null,
    thumbnailPhotoUrl:
      photos[0]?.thumbnailUrl ||
      photos[0]?.mediumUrl ||
      photos[0]?.originalUrl ||
      null,

    location: submission.location || null,

    tagId: submission.tagId || null,
    tagLabel: submission.tagLabel || null,

    subtags: Array.isArray(submission.subtags) ? submission.subtags : [],
    approaches: Array.isArray(submission.approaches)
      ? submission.approaches
      : [],

    price: submission.price || null,

    openingHours,

    // Alias temporal para que el frontend viejo siga funcionando.
    schedule: openingHours.label,

    reviewCycle: submission.reviewCycle || 1,
    wasReturnedBefore: Boolean(submission.wasReturnedBefore),

    returnReason: submission.returnReason || null,
    rejectionReason: submission.rejectionReason || null,
    reviewHistory: Array.isArray(submission.reviewHistory)
      ? submission.reviewHistory
      : [],
  };
}