import {
  db,
  firebaseAdmin,
} from "../../../config/firebase.js";

const SIGNED_URL_DURATION_MS = 60 * 60 * 1000;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getFileName(storagePath) {
  return storagePath.split("/").pop() || "";
}

function sortFilesNaturally(files) {
  return [...files].sort((firstFile, secondFile) =>
    getFileName(firstFile.name).localeCompare(
      getFileName(secondFile.name),
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      }
    )
  );
}

async function createSignedUrl(file) {
  const [url] = await file.getSignedUrl({
    action: "read",
    expires:
      Date.now() + SIGNED_URL_DURATION_MS,
  });

  return url;
}

async function getOriginalFilesFromPrefix({
  bucket,
  prefix,
  sourceType,
  submissionId,
}) {
  const [files] = await bucket.getFiles({
    prefix: `${prefix}/`,
  });

  const imageFiles = sortFilesNaturally(
    files.filter((file) => {
      const fileName = getFileName(file.name);

      return /\.(jpg|jpeg|png|webp)$/i.test(
        fileName
      );
    })
  );

  return Promise.all(
    imageFiles.map(async (file, index) => ({
      id: `${sourceType}-${submissionId}-${index + 1}`,
      sourceType,
      submissionId,
      order: index,
      fileName: getFileName(file.name),
      originalUrl: await createSignedUrl(file),
    }))
  );
}

function getOwnerId(submission) {
  return (
    submission.createdBy ||
    submission.userId ||
    submission.uid ||
    submission.submittedBy?.uid ||
    submission.user?.uid ||
    null
  );
}

export default async function getAdminPlaceLsearchGalleryService({
  placeId,
}) {
  if (!placeId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400
    );
  }

  const placeSnapshot = await db
    .collection("places")
    .doc(placeId)
    .get();

  if (!placeSnapshot.exists) {
    throw createHttpError(
      "No se encontró el lugar solicitado.",
      404
    );
  }

  const place = placeSnapshot.data();

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

  const gallerySources = [];

  /*
   * 1. Fotografías originales de la propuesta
   * con la que nació el lugar.
   */
  const originSubmissionId =
    place.origin?.submissionId ||
    place.submissionId ||
    null;

  if (
    place.origin?.type === "place_submission" &&
    originSubmissionId
  ) {
    const submissionSnapshot = await db
      .collection("placeSubmissions")
      .doc(originSubmissionId)
      .get();

    if (submissionSnapshot.exists) {
      const submission =
        submissionSnapshot.data();

      const ownerId =
        getOwnerId(submission);

      if (ownerId) {
        gallerySources.push({
          sourceType: "place_submission",
          submissionId: originSubmissionId,
          prefix: [
            "submissions",
            ownerId,
            "placeSubmissions",
            originSubmissionId,
            "original",
          ].join("/"),
        });
      }
    }
  }

  /*
   * 2. Propuestas de fotos aprobadas
   * asociadas a este lugar.
   */
  const photoSubmissionsSnapshot = await db
    .collection("photoSubmissions")
    .where("placeId", "==", placeId)
    .where("status", "==", "approved")
    .get();

  photoSubmissionsSnapshot.forEach((snapshot) => {
    const submission = snapshot.data();

    const ownerId =
      getOwnerId(submission);

    if (!ownerId) {
      return;
    }

    gallerySources.push({
      sourceType: "photo_submission",
      submissionId: snapshot.id,
      prefix: [
        "submissions",
        ownerId,
        "photoSubmissions",
        placeId,
        snapshot.id,
        "original",
      ].join("/"),
    });
  });

  const galleryParts = await Promise.all(
    gallerySources.map((source) =>
      getOriginalFilesFromPrefix({
        bucket,
        prefix: source.prefix,
        sourceType: source.sourceType,
        submissionId: source.submissionId,
      })
    )
  );

  const photos = galleryParts
    .flat()
    .map((photo, index) => ({
      ...photo,
      galleryOrder: index,
    }));

  return {
    placeId,
    photoCount: photos.length,
    photos,
    sources: gallerySources.map((source) => ({
      sourceType: source.sourceType,
      submissionId: source.submissionId,
    })),
  };
}