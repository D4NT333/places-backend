import { db } from "../../../../config/firebase.js";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

const PLACES_COLLECTION = "places";

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 6;

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizePhoto(photo) {
  return {
    photoId: cleanString(photo?.photoId),

    order:
      Number.isInteger(photo?.order)
        ? photo.order
        : 0,

    original: {
      url: cleanString(
        photo?.original?.url
      ),

      path: cleanString(
        photo?.original?.path
      ),

      fileName: cleanString(
        photo?.original?.fileName
      ),

      width:
        Number.isFinite(
          photo?.original?.width
        )
          ? photo.original.width
          : null,

      height:
        Number.isFinite(
          photo?.original?.height
        )
          ? photo.original.height
          : null,

      size:
        Number.isFinite(
          photo?.original?.size
        )
          ? photo.original.size
          : null,

      mimeType: cleanString(
        photo?.original?.mimeType
      ),
    },

    medium: {
      url: cleanString(
        photo?.medium?.url
      ),

      path: cleanString(
        photo?.medium?.path
      ),

      fileName: cleanString(
        photo?.medium?.fileName
      ),

      width:
        Number.isFinite(
          photo?.medium?.width
        )
          ? photo.medium.width
          : null,

      height:
        Number.isFinite(
          photo?.medium?.height
        )
          ? photo.medium.height
          : null,

      size:
        Number.isFinite(
          photo?.medium?.size
        )
          ? photo.medium.size
          : null,

      mimeType: cleanString(
        photo?.medium?.mimeType
      ),
    },

    thumbnail: {
      url: cleanString(
        photo?.thumbnail?.url
      ),

      path: cleanString(
        photo?.thumbnail?.path
      ),

      fileName: cleanString(
        photo?.thumbnail?.fileName
      ),

      width:
        Number.isFinite(
          photo?.thumbnail?.width
        )
          ? photo.thumbnail.width
          : null,

      height:
        Number.isFinite(
          photo?.thumbnail?.height
        )
          ? photo.thumbnail.height
          : null,

      size:
        Number.isFinite(
          photo?.thumbnail?.size
        )
          ? photo.thumbnail.size
          : null,

      mimeType: cleanString(
        photo?.thumbnail?.mimeType
      ),
    },

    source: "user",

    uploadedAt:
      cleanString(photo?.uploadedAt) ||
      new Date().toISOString(),
  };
}

function photoHasRequiredVersions(photo) {
  return Boolean(
    photo.photoId &&
      photo.original.url &&
      photo.original.path &&
      photo.medium.url &&
      photo.medium.path &&
      photo.thumbnail.url &&
      photo.thumbnail.path
  );
}

function photoBelongsToExpectedStoragePath({
  photo,
  expectedBasePath,
}) {
  const paths = [
    photo.original.path,
    photo.medium.path,
    photo.thumbnail.path,
  ];

  return paths.every((path) =>
    path.startsWith(expectedBasePath)
  );
}

export default async function createPhotoSubmissionController(
  req,
  res
) {
  try {
    const userId = req.user?.uid;

    const userName =
      cleanString(req.user?.name) ||
      cleanString(req.user?.email) ||
      "Usuario";

    const placeId = cleanString(
      req.params.placeId
    );

    const photoSubmissionId =
      cleanString(
        req.body?.photoSubmissionId
      );

    const receivedPhotos =
      req.body?.photos;

    if (!userId) {
      return res.status(401).json({
        message:
          "No se encontró un usuario autenticado.",
      });
    }

    if (!placeId) {
      return res.status(400).json({
        message:
          "Falta el identificador del lugar.",
      });
    }

    if (!photoSubmissionId) {
      return res.status(400).json({
        message:
          "Falta el identificador de la propuesta.",
      });
    }

    if (!Array.isArray(receivedPhotos)) {
      return res.status(400).json({
        message:
          "Las fotografías enviadas no son válidas.",
      });
    }

    if (
      receivedPhotos.length < MIN_PHOTOS ||
      receivedPhotos.length > MAX_PHOTOS
    ) {
      return res.status(400).json({
        message:
          `La propuesta debe incluir entre ${MIN_PHOTOS} y ${MAX_PHOTOS} fotografías.`,
      });
    }

    /*
     * Comprobamos que el lugar exista.
     */
    const placeReference = db
      .collection(PLACES_COLLECTION)
      .doc(placeId);

    const placeSnapshot =
      await placeReference.get();

    if (!placeSnapshot.exists) {
      return res.status(404).json({
        message:
          "No se encontró el lugar.",
      });
    }

    const placeData =
      placeSnapshot.data() || {};

    /*
     * Evitamos una segunda propuesta pendiente
     * del mismo usuario para el mismo lugar.
     */
    const pendingSubmissionSnapshot =
      await db
        .collection(
          PHOTO_SUBMISSIONS_COLLECTION
        )
        .where(
          "createdBy",
          "==",
          userId
        )
        .where(
          "placeId",
          "==",
          placeId
        )
        .where(
          "status",
          "==",
          "in_review"
        )
        .limit(1)
        .get();

    if (!pendingSubmissionSnapshot.empty) {
      return res.status(409).json({
        message:
          "Ya tienes una propuesta de fotografías en revisión para este lugar.",
      });
    }

    const submissionReference = db
      .collection(
        PHOTO_SUBMISSIONS_COLLECTION
      )
      .doc(photoSubmissionId);

    const existingSubmission =
      await submissionReference.get();

    if (existingSubmission.exists) {
      return res.status(409).json({
        message:
          "Ya existe una propuesta con este identificador.",
      });
    }

    const photos = receivedPhotos
      .map(normalizePhoto)
      .sort(
        (firstPhoto, secondPhoto) =>
          firstPhoto.order -
          secondPhoto.order
      );

    const invalidPhoto =
      photos.find(
        (photo) =>
          !photoHasRequiredVersions(
            photo
          )
      );

    if (invalidPhoto) {
      return res.status(400).json({
        message:
          "Una o más fotografías no contienen todas sus versiones.",
      });
    }

    const expectedBasePath =
      `submissions/${userId}` +
      `/photoSubmissions/${placeId}` +
      `/${photoSubmissionId}/`;

    const invalidStoragePath =
      photos.find(
        (photo) =>
          !photoBelongsToExpectedStoragePath({
            photo,
            expectedBasePath,
          })
      );

    if (invalidStoragePath) {
      return res.status(400).json({
        message:
          "Una o más fotografías no pertenecen a la ruta esperada.",
      });
    }

    const now =
      new Date().toISOString();

    const submissionData = {
      submissionId:
        photoSubmissionId,

      placeId,

      placeName:
        cleanString(placeData.name) ||
        "Lugar sin nombre",

      createdBy: userId,
      createdByName: userName,

      status: "in_review",

      photoCount: photos.length,

      /*
       * Se guarda el thumbnail principal también
       * arriba para que el listado sea sencillo.
       */
      thumbnailUrl:
        photos[0]?.thumbnail?.url || "",

      thumbnailPath:
        photos[0]?.thumbnail?.path || "",

      photos,

      createdAt:
        new Date(),

      updatedAt:
        new Date(),

      approvedAt: null,
      approvedBy: null,

      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
    };

    await submissionReference.set(
      submissionData
    );

    return res.status(201).json({
      message:
        "Propuesta de fotografías creada correctamente.",

      submission: {
        id: submissionReference.id,

        submissionId:
          photoSubmissionId,

        placeId,

        placeName:
          submissionData.placeName,

        status:
          submissionData.status,

        photoCount:
          submissionData.photoCount,

        thumbnailUrl:
          submissionData.thumbnailUrl,

        createdAt: now,
      },
    });
  } catch (error) {
    console.error(
      "Error creando propuesta de fotografías:",
      error
    );

    return res.status(500).json({
      message:
        "No se pudo registrar la propuesta de fotografías.",
    });
  }
}