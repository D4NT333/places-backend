import { db } from "../../../../config/firebase.js";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

const PLACES_COLLECTION =
  "places";

const MAX_PLACE_PHOTOS = 10;

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function createServiceError(
  message,
  statusCode
) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
}

function normalizeNumber(value) {
  return Number.isFinite(value)
    ? value
    : null;
}

function normalizePhotoVersion(
  version
) {
  return {
    url:
      cleanString(
        version?.url
      ),

    path:
      cleanString(
        version?.path
      ),

    fileName:
      cleanString(
        version?.fileName
      ),

    width:
      normalizeNumber(
        version?.width
      ),

    height:
      normalizeNumber(
        version?.height
      ),

    size:
      normalizeNumber(
        version?.size
      ),

    mimeType:
      cleanString(
        version?.mimeType
      ),
  };
}

/*
 * Convierte una fotografía de photoSubmissions
 * al formato que se guardará en places.photos.
 */
function normalizeApprovedPhoto({
  photo,
  index,
  submissionId,
  createdBy,
  approvedAt,
}) {
  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return null;
  }

  const original =
    normalizePhotoVersion(
      photo.original
    );

  const medium =
    normalizePhotoVersion(
      photo.medium
    );

  const thumbnail =
    normalizePhotoVersion(
      photo.thumbnail
    );

  if (!medium.url) {
    return null;
  }

  const photoId =
    cleanString(photo.photoId) ||
    `photo_${index + 1}`;

  return {
    photoId,

    source: "user",

    /*
     * Permite saber de qué propuesta salió
     * y evita insertar dos veces las mismas fotos.
     */
    sourceSubmissionId:
      submissionId,

    uploadedBy:
      createdBy,

    order: index,

    /*
     * Campos directos para facilitar el consumo
     * desde feed, cards y carruseles.
     */
    url:
      medium.url,

    path:
      medium.path,

    widthPx:
      medium.width,

    heightPx:
      medium.height,

    original,
    medium,
    thumbnail,

    uploadedAt:
      cleanString(
        photo.uploadedAt
      ) || null,

    approvedAt:
      approvedAt.toISOString(),
  };
}

function getPhotoUniqueKey(
  photo,
  index
) {
  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return `unknown-${index}`;
  }

  const source =
    cleanString(photo.source);

  if (source === "user") {
    const sourceSubmissionId =
      cleanString(
        photo.sourceSubmissionId
      );

    const photoId =
      cleanString(photo.photoId);

    if (
      sourceSubmissionId ||
      photoId
    ) {
      return (
        `user:` +
        `${sourceSubmissionId}:` +
        `${photoId}`
      );
    }

    const userUrl =
      cleanString(
        photo?.medium?.url
      ) ||
      cleanString(photo.url);

    if (userUrl) {
      return `user-url:${userUrl}`;
    }
  }

  const reference =
    cleanString(
      photo.reference
    );

  if (reference) {
    return `google:${reference}`;
  }

  const url =
    cleanString(photo.url) ||
    cleanString(
      photo?.medium?.url
    );

  if (url) {
    return `url:${url}`;
  }

  return `unknown-${index}`;
}

function removeDuplicatePhotos(
  photos
) {
  const seenKeys =
    new Set();

  return photos.filter(
    (photo, index) => {
      const key =
        getPhotoUniqueKey(
          photo,
          index
        );

      if (seenKeys.has(key)) {
        return false;
      }

      seenKeys.add(key);

      return true;
    }
  );
}

function reorderPhotos(
  photos
) {
  return photos.map(
    (photo, index) => ({
      ...photo,
      order: index,
    })
  );
}

function createMainPhoto(
  photo
) {
  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return null;
  }

  if (
    cleanString(photo.source) ===
    "user"
  ) {
    return {
      photoId:
        cleanString(
          photo.photoId
        ),

      source: "user",

      sourceSubmissionId:
        cleanString(
          photo.sourceSubmissionId
        ),

      uploadedBy:
        cleanString(
          photo.uploadedBy
        ),

      order: 0,

      /*
       * URL directa para que el frontend
       * no necesite resolver Google.
       */
      url:
        cleanString(
          photo?.medium?.url
        ) ||
        cleanString(photo.url),

      path:
        cleanString(
          photo?.medium?.path
        ) ||
        cleanString(photo.path),

      widthPx:
        normalizeNumber(
          photo?.medium?.width
        ) ??
        normalizeNumber(
          photo.widthPx
        ),

      heightPx:
        normalizeNumber(
          photo?.medium?.height
        ) ??
        normalizeNumber(
          photo.heightPx
        ),

      original:
        photo.original || null,

      medium:
        photo.medium || null,

      thumbnail:
        photo.thumbnail || null,
    };
  }

  /*
   * Conserva compatibilidad con
   * las fotografías de Google.
   */
  return {
    source:
      cleanString(
        photo.source
      ) || "google",

    reference:
      cleanString(
        photo.reference
      ),

    order: 0,

    widthPx:
      normalizeNumber(
        photo.widthPx
      ),

    heightPx:
      normalizeNumber(
        photo.heightPx
      ),
  };
}

export default async function approvePhotoSubmissionService({
  submissionId,
  approvedBy,
}) {
  const normalizedSubmissionId =
    cleanString(submissionId);

  const normalizedApprovedBy =
    cleanString(approvedBy);

  if (!normalizedApprovedBy) {
    throw createServiceError(
      "No se encontró un administrador autenticado.",
      401
    );
  }

  if (!normalizedSubmissionId) {
    throw createServiceError(
      "Falta el identificador de la propuesta.",
      400
    );
  }

  const submissionReference = db
    .collection(
      PHOTO_SUBMISSIONS_COLLECTION
    )
    .doc(
      normalizedSubmissionId
    );

  const result =
    await db.runTransaction(
      async (transaction) => {
        const submissionSnapshot =
          await transaction.get(
            submissionReference
          );

        if (
          !submissionSnapshot.exists
        ) {
          throw createServiceError(
            "No se encontró la propuesta de fotografías.",
            404
          );
        }

        const submissionData =
          submissionSnapshot.data() ||
          {};

        const currentStatus =
          cleanString(
            submissionData.status
          );

        if (
          currentStatus !==
          "in_review"
        ) {
          throw createServiceError(
            "La propuesta ya fue revisada y no puede aprobarse nuevamente.",
            409
          );
        }

        const placeId =
          cleanString(
            submissionData.placeId
          );

        if (!placeId) {
          throw createServiceError(
            "La propuesta no contiene un lugar válido.",
            400
          );
        }

        const placeReference = db
          .collection(
            PLACES_COLLECTION
          )
          .doc(placeId);

        const placeSnapshot =
          await transaction.get(
            placeReference
          );

        if (!placeSnapshot.exists) {
          throw createServiceError(
            "No se encontró el lugar asociado a la propuesta.",
            404
          );
        }

        const placeData =
          placeSnapshot.data() ||
          {};

        const approvedAt =
          new Date();

        const submissionPhotos =
          Array.isArray(
            submissionData.photos
          )
            ? submissionData.photos
            : [];

        const newUserPhotos =
          submissionPhotos
            .map(
              (
                photo,
                index
              ) =>
                normalizeApprovedPhoto({
                  photo,
                  index,

                  submissionId:
                    normalizedSubmissionId,

                  createdBy:
                    cleanString(
                      submissionData
                        .createdBy
                    ),

                  approvedAt,
                })
            )
            .filter(Boolean);

        if (
          newUserPhotos.length ===
          0
        ) {
          throw createServiceError(
            "La propuesta no contiene fotografías válidas para aprobar.",
            400
          );
        }

        const currentPlacePhotos =
          Array.isArray(
            placeData.photos
          )
            ? placeData.photos
            : [];

        /*
         * Evitamos conservar fotos de esta misma
         * propuesta en caso de datos repetidos.
         */
        const existingPhotos =
          currentPlacePhotos.filter(
            (photo) =>
              cleanString(
                photo
                  ?.sourceSubmissionId
              ) !==
              normalizedSubmissionId
          );

        const existingUserPhotos =
          existingPhotos.filter(
            (photo) =>
              cleanString(
                photo?.source
              ) === "user"
          );

        const googleAndOtherPhotos =
          existingPhotos.filter(
            (photo) =>
              cleanString(
                photo?.source
              ) !== "user"
          );

        /*
         * Orden de prioridad:
         *
         * 1. Fotografías recién aprobadas.
         * 2. Fotografías anteriores de usuarios.
         * 3. Fotografías de Google.
         */
        const mergedPhotos =
          removeDuplicatePhotos([
            ...newUserPhotos,
            ...existingUserPhotos,
            ...googleAndOtherPhotos,
          ]);

        const nextPhotos =
          reorderPhotos(
            mergedPhotos.slice(
              0,
              MAX_PLACE_PHOTOS
            )
          );

        const mainPhoto =
          createMainPhoto(
            nextPhotos[0]
          );

        transaction.update(
          placeReference,
          {
            photos:
              nextPhotos,

            mainPhoto,

            photoCount:
              nextPhotos.length,

            updatedAt:
              approvedAt,
          }
        );

        transaction.update(
          submissionReference,
          {
            status:
              "approved",

            approvedAt,

            approvedBy:
              normalizedApprovedBy,

            updatedAt:
              approvedAt,
          }
        );

        return {
          id:
            submissionSnapshot.id,

          submissionId:
            cleanString(
              submissionData
                .submissionId
            ) ||
            submissionSnapshot.id,

          placeId,

          placeName:
            cleanString(
              submissionData
                .placeName
            ) ||
            cleanString(
              placeData.name
            ) ||
            "Lugar sin nombre",

          status:
            "approved",

          approvedAt:
            approvedAt
              .toISOString(),

          approvedBy:
            normalizedApprovedBy,

          approvedPhotosCount:
            newUserPhotos.length,

          placePhotoCount:
            nextPhotos.length,

          mainPhoto,
        };
      }
    );

  return result;
}