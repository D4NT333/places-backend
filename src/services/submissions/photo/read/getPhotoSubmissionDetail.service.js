import { db } from "../../../../config/firebase.js";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

function createServiceError(
  message,
  statusCode
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function timestampToISOString(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    typeof value === "object" &&
    typeof value._seconds ===
      "number"
  ) {
    return new Date(
      value._seconds * 1000
    ).toISOString();
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function getUrl(value) {
  if (
    typeof value === "string"
  ) {
    return value.trim();
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  return cleanString(
    value.url ||
      value.downloadURL ||
      value.downloadUrl ||
      value.uri
  );
}

function getPath(value) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  return cleanString(
    value.path ||
      value.storagePath ||
      value.fullPath
  );
}

function getVariantUrl(
  photo,
  variant
) {
  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return "";
  }

  const directCandidates = {
    original: [
      photo.originalUrl,
      photo.originalURL,
      photo.originalDownloadURL,
    ],

    medium: [
      photo.mediumUrl,
      photo.mediumURL,
      photo.mediumDownloadURL,
    ],

    thumbnail: [
      photo.thumbnailUrl,
      photo.thumbnailURL,
      photo.thumbnailDownloadURL,
    ],
  };

  const nestedValue =
    photo[variant];

  const candidates = [
    ...(directCandidates[
      variant
    ] || []),

    nestedValue,
  ];

  for (
    const candidate of candidates
  ) {
    const url = getUrl(candidate);

    if (url) {
      return url;
    }
  }

  return "";
}

function getVariantPath(
  photo,
  variant
) {
  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return "";
  }

  const directCandidates = {
    original: [
      photo.originalPath,
    ],

    medium: [
      photo.mediumPath,
    ],

    thumbnail: [
      photo.thumbnailPath,
    ],
  };

  const candidates = [
    ...(directCandidates[
      variant
    ] || []),

    photo[variant],
  ];

  for (
    const candidate of candidates
  ) {
    if (
      typeof candidate ===
      "string"
    ) {
      const path =
        candidate.trim();

      /*
       * Evita confundir una URL con
       * una ruta de Storage.
       */
      if (
        path &&
        !path.startsWith("http")
      ) {
        return path;
      }

      continue;
    }

    const path =
      getPath(candidate);

    if (path) {
      return path;
    }
  }

  return "";
}

function normalizePhoto(
  photo,
  index
) {
  if (
    typeof photo === "string"
  ) {
    return {
      id: `photo-${index + 1}`,
      photoId: `photo-${index + 1}`,
      order: index,

      originalUrl: photo,
      mediumUrl: photo,
      thumbnailUrl: photo,

      originalPath: "",
      mediumPath: "",
      thumbnailPath: "",

      displayUrl: photo,
    };
  }

  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return null;
  }

  const realOriginalUrl =
    getVariantUrl(
      photo,
      "original"
    );

  const realMediumUrl =
    getVariantUrl(
      photo,
      "medium"
    );

  const realThumbnailUrl =
    getVariantUrl(
      photo,
      "thumbnail"
    );

  const fallbackUrl =
    getUrl(
      photo.url ||
        photo.downloadURL ||
        photo.uri ||
        photo.imageUrl
    );

  /*
   * La medium es la principal para el carrusel.
   * Si no existe, usamos original o thumbnail.
   */
  const mediumUrl =
    realMediumUrl ||
    realOriginalUrl ||
    realThumbnailUrl ||
    fallbackUrl;

  const originalUrl =
    realOriginalUrl ||
    mediumUrl;

  const thumbnailUrl =
    realThumbnailUrl ||
    mediumUrl;

  if (
    !mediumUrl &&
    !originalUrl &&
    !thumbnailUrl
  ) {
    return null;
  }

  const rawOrder =
    Number(photo.order);

  const order =
    Number.isInteger(rawOrder)
      ? rawOrder
      : index;

  const photoId =
    cleanString(
      photo.photoId ||
        photo.id
    ) ||
    `photo-${index + 1}`;

  return {
    id: photoId,
    photoId,
    order,

    originalUrl,
    mediumUrl,
    thumbnailUrl,

    originalPath:
      getVariantPath(
        photo,
        "original"
      ),

    mediumPath:
      getVariantPath(
        photo,
        "medium"
      ),

    thumbnailPath:
      getVariantPath(
        photo,
        "thumbnail"
      ),

    /*
     * También regresamos las variantes
     * anidadas para mantener compatibilidad.
     */
    original: {
      url: originalUrl,

      path:
        getVariantPath(
          photo,
          "original"
        ),
    },

    medium: {
      url: mediumUrl,

      path:
        getVariantPath(
          photo,
          "medium"
        ),
    },

    thumbnail: {
      url: thumbnailUrl,

      path:
        getVariantPath(
          photo,
          "thumbnail"
        ),
    },

    displayUrl: mediumUrl,

    contentType:
      cleanString(
        photo.contentType
      ),

    width:
      Number(photo.width) ||
      null,

    height:
      Number(photo.height) ||
      null,

    size:
      Number(
        photo.size ||
        photo.sizeBytes
      ) || null,
  };
}

function normalizePhotos(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizePhoto)
    .filter(Boolean)
    .sort(
      (firstPhoto, secondPhoto) =>
        firstPhoto.order -
        secondPhoto.order
    );
}

async function findSubmissionDocument(
  submissionId
) {
  /*
   * Normalmente submissionId también es
   * el ID del documento.
   */
  const directDocument =
    await db
      .collection(
        PHOTO_SUBMISSIONS_COLLECTION
      )
      .doc(submissionId)
      .get();

  if (directDocument.exists) {
    return directDocument;
  }

  /*
   * Respaldo por si algún documento fue
   * creado con otro ID interno.
   */
  const querySnapshot =
    await db
      .collection(
        PHOTO_SUBMISSIONS_COLLECTION
      )
      .where(
        "submissionId",
        "==",
        submissionId
      )
      .limit(1)
      .get();

  if (querySnapshot.empty) {
    return null;
  }

  return querySnapshot.docs[0];
}

export default async function getPhotoSubmissionDetailService(
  submissionId
) {
  const normalizedSubmissionId =
    cleanString(submissionId);

  if (!normalizedSubmissionId) {
    throw createServiceError(
      "El identificador de la propuesta es obligatorio.",
      400
    );
  }

  const documentSnapshot =
    await findSubmissionDocument(
      normalizedSubmissionId
    );

  if (!documentSnapshot) {
    throw createServiceError(
      "No se encontró la propuesta de fotografías.",
      404
    );
  }

  const data =
    documentSnapshot.data() ||
    {};

  const photos =
    normalizePhotos(
      data.photos ||
      data.images ||
      []
    );

  const storedPhotoCount =
    Number(data.photoCount);

  const photoCount =
    Number.isInteger(
      storedPhotoCount
    ) &&
    storedPhotoCount >= 0
      ? storedPhotoCount
      : photos.length;

  return {
    id: documentSnapshot.id,

    submissionId:
      cleanString(
        data.submissionId
      ) ||
      documentSnapshot.id,

    placeId:
      cleanString(
        data.placeId
      ),

    placeName:
      cleanString(
        data.placeName
      ) ||
      "Lugar sin nombre",

    createdBy:
      cleanString(
        data.createdBy
      ),

    createdByName:
      cleanString(
        data.createdByName
      ) ||
      "Usuario",

    status:
      cleanString(
        data.status
      ) ||
      "in_review",

    photoCount,
    photos,

    /*
     * La vista puede usar estas propiedades
     * directamente como portada.
     */
    imageUrl:
      photos[0]?.mediumUrl ||
      "",

    mediumUrl:
      photos[0]?.mediumUrl ||
      "",

    thumbnailUrl:
      photos[0]
        ?.thumbnailUrl ||
      "",

    createdAt:
      timestampToISOString(
        data.createdAt
      ),

    updatedAt:
      timestampToISOString(
        data.updatedAt
      ),

    approvedAt:
      timestampToISOString(
        data.approvedAt
      ),

    approvedBy:
      cleanString(
        data.approvedBy
      ) ||
      null,

    rejectedAt:
      timestampToISOString(
        data.rejectedAt
      ),

    rejectedBy:
      cleanString(
        data.rejectedBy
      ) ||
      null,

    rejectionReason:
      data.rejectionReason ||
      null,
  };
}