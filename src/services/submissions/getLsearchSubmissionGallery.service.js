import {
  db,
  firebaseAdmin,
} from "../../config/firebase.js";

const SUBMISSION_TYPES = {
  PLACE: "place",
  PHOTO: "photo",
};

const SUBMISSION_CONFIG = {
  [SUBMISSION_TYPES.PLACE]: {
    collection: "placeSubmissions",
    storageFolder: "placeSubmissions",
  },

  [SUBMISSION_TYPES.PHOTO]: {
    collection: "photoSubmissions",
    storageFolder: "photoSubmissions",
  },
};

const SIGNED_URL_DURATION_MS = 60 * 60 * 1000;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRequiredString(value, fieldName) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw createHttpError(
      `${fieldName} es obligatorio.`,
      400
    );
  }

  const normalizedValue = value.trim();

  if (
    normalizedValue.includes("/") ||
    normalizedValue.includes("\\") ||
    normalizedValue.includes("..")
  ) {
    throw createHttpError(
      `${fieldName} contiene un valor inválido.`,
      400
    );
  }

  return normalizedValue;
}

function normalizeSubmissionType(value) {
  const normalizedType =
    typeof value === "string"
      ? value.trim().toLowerCase()
      : "";

  if (!SUBMISSION_CONFIG[normalizedType]) {
    throw createHttpError(
      "El tipo de propuesta debe ser place o photo.",
      400
    );
  }

  return normalizedType;
}

function getSubmissionOwnerId(submission) {
  return (
    submission.createdBy ||
    submission.userId ||
    submission.uid ||
    submission.submittedBy?.uid ||
    submission.user?.uid ||
    null
  );
}

function getSubmissionPlaceId(submission) {
  return (
    submission.placeId ||
    submission.place?.placeId ||
    submission.relatedPlaceId ||
    null
  );
}

function buildStoragePrefix({
  submissionType,
  ownerId,
  submissionId,
  placeId,
}) {
  if (submissionType === SUBMISSION_TYPES.PLACE) {
    return [
      "submissions",
      ownerId,
      "placeSubmissions",
      submissionId,
      "original",
    ].join("/");
  }

  if (!placeId) {
    throw createHttpError(
      "La propuesta de fotografías no tiene placeId.",
      409
    );
  }

  return [
    "submissions",
    ownerId,
    "photoSubmissions",
    placeId,
    submissionId,
    "original",
  ].join("/");
}

function getFileName(storagePath) {
  return storagePath.split("/").pop() || "";
}

function sortFilesNaturally(files) {
  return [...files].sort((firstFile, secondFile) => {
    const firstName = getFileName(firstFile.name);
    const secondName = getFileName(secondFile.name);

    return firstName.localeCompare(
      secondName,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      }
    );
  });
}

async function createReadUrl(file) {
  const [url] = await file.getSignedUrl({
    action: "read",
    expires:
      Date.now() + SIGNED_URL_DURATION_MS,
  });

  return url;
}

export default async function getLsearchSubmissionGalleryService({
  submissionType,
  submissionId,
}) {
  const normalizedType =
    normalizeSubmissionType(submissionType);

  const normalizedSubmissionId =
    normalizeRequiredString(
      submissionId,
      "submissionId"
    );

  const config =
    SUBMISSION_CONFIG[normalizedType];

  /*
   * Primero buscamos el documento.
   *
   * No confiamos en que el frontend mande ownerId,
   * placeId o una ruta de Storage.
   */
  const submissionRef = db
    .collection(config.collection)
    .doc(normalizedSubmissionId);

  const submissionSnapshot =
    await submissionRef.get();

  if (!submissionSnapshot.exists) {
    throw createHttpError(
      "No se encontró la propuesta solicitada.",
      404
    );
  }

  const submission = submissionSnapshot.data();

  const ownerId = normalizeRequiredString(
    getSubmissionOwnerId(submission),
    "ownerId de la propuesta"
  );

  const rawPlaceId =
    normalizedType === SUBMISSION_TYPES.PHOTO
      ? getSubmissionPlaceId(submission)
      : null;

  const placeId = rawPlaceId
    ? normalizeRequiredString(
        rawPlaceId,
        "placeId"
      )
    : null;

  const storagePrefix = buildStoragePrefix({
    submissionType: normalizedType,
    ownerId,
    submissionId: normalizedSubmissionId,
    placeId,
  });

  /*
   * En tu firebase.js todavía no se configura
   * storageBucket dentro de initializeApp.
   *
   * Por eso usamos explícitamente la variable
   * FIREBASE_STORAGE_BUCKET.
   */
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    throw createHttpError(
      "Falta configurar FIREBASE_STORAGE_BUCKET.",
      500
    );
  }

  const bucket = firebaseAdmin
    .storage()
    .bucket(bucketName);

  const [files] = await bucket.getFiles({
    prefix: `${storagePrefix}/`,
  });

  const imageFiles = sortFilesNaturally(
    files.filter((file) => {
      const fileName = getFileName(file.name);

      if (!fileName) {
        return false;
      }

      return /\.(jpg|jpeg|png|webp)$/i.test(
        fileName
      );
    })
  );

  if (imageFiles.length === 0) {
    return {
      submissionType: normalizedType,
      submissionId: normalizedSubmissionId,
      placeId,
      photoCount: 0,
      photos: [],
    };
  }

  const photos = await Promise.all(
    imageFiles.map(async (file, index) => {
      const [metadata, originalUrl] =
        await Promise.all([
          file.getMetadata(),
          createReadUrl(file),
        ]);

      return {
        photoId: `${normalizedSubmissionId}_${index + 1}`,
        order: index,
        fileName: getFileName(file.name),

        /*
         * La galería podrá usar directamente:
         *
         * photo.originalUrl
         */
        originalUrl,

        contentType:
          metadata[0]?.contentType ||
          "application/octet-stream",

        sizeBytes:
          Number(metadata[0]?.size) || 0,

        width:
          Number(
            metadata[0]?.metadata?.width
          ) || null,

        height:
          Number(
            metadata[0]?.metadata?.height
          ) || null,
      };
    })
  );

  return {
    submissionType: normalizedType,
    submissionId: normalizedSubmissionId,
    placeId,
    photoCount: photos.length,
    photos,
  };
}