import {
  db,
  FieldValue,
} from "../../config/firebase.js";

const BATCH_LIMIT = 450;

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

/*
 * Extrae todas las rutas de Storage existentes dentro
 * de un objeto de fotografía.
 *
 * Detecta:
 * photo.path
 * photo.original.path
 * photo.medium.path
 * photo.thumbnail.path
 */
function collectStoragePathsFromValue(
  value,
  protectedPaths,
) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectStoragePathsFromValue(
        item,
        protectedPaths,
      );
    });

    return;
  }

  if (
    typeof value !== "object"
  ) {
    return;
  }

  Object.entries(value).forEach(
    ([key, childValue]) => {
      if (
        key === "path" &&
        typeof childValue === "string"
      ) {
        const normalizedPath =
          childValue.trim();

        if (normalizedPath) {
          protectedPaths.add(
            normalizedPath,
          );
        }
      }

      collectStoragePathsFromValue(
        childValue,
        protectedPaths,
      );
    },
  );
}

/*
 * Elimina identificadores personales dentro de los
 * objetos de fotos sin cambiar sus URLs o rutas.
 */
function anonymizePhotoValue(
  value,
  uid,
) {
  if (Array.isArray(value)) {
    return value.map((item) =>
      anonymizePhotoValue(item, uid),
    );
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return value;
  }

  const cleaned = {};

  Object.entries(value).forEach(
    ([key, childValue]) => {
      const isUserReferenceField = [
        "uploadedBy",
        "createdBy",
        "createdByUid",
        "submittedBy",
        "userId",
        "uid",
      ].includes(key);

      if (
        isUserReferenceField &&
        cleanText(childValue) === uid
      ) {
        return;
      }

      cleaned[key] =
        anonymizePhotoValue(
          childValue,
          uid,
        );
    },
  );

  return cleaned;
}

async function anonymizePlacesQuery({
  query,
  uid,
  processedPlaceIds,
  protectedStoragePaths,
}) {
  let totalUpdated = 0;

  while (true) {
    const snapshot = await query
      .limit(BATCH_LIMIT)
      .get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();

    snapshot.docs.forEach(
      (document) => {
        /*
         * Un lugar podría coincidir con createdBy,
         * createdByUid y userId.
         *
         * Evitamos contarlo y actualizarlo varias veces.
         */
        if (
          processedPlaceIds.has(
            document.id,
          )
        ) {
          return;
        }

        processedPlaceIds.add(
          document.id,
        );

        const data =
          document.data();

        collectStoragePathsFromValue(
          data.mainPhoto,
          protectedStoragePaths,
        );

        collectStoragePathsFromValue(
          data.photos,
          protectedStoragePaths,
        );

        const anonymizedMainPhoto =
          anonymizePhotoValue(
            data.mainPhoto,
            uid,
          );

        const anonymizedPhotos =
          anonymizePhotoValue(
            Array.isArray(data.photos)
              ? data.photos
              : [],
            uid,
          );

        const updateData = {
          createdBy: null,
          createdByUid: null,
          userId: null,

          creatorDeleted: true,
          creatorDeletedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),

          mainPhoto:
            anonymizedMainPhoto,

          photos:
            anonymizedPhotos,

          /*
           * El lugar conserva su origen técnico,
           * pero ya no conserva el UID del usuario.
           */
          "origin.submittedBy":
            FieldValue.delete(),
        };

        batch.update(
          document.ref,
          updateData,
        );

        totalUpdated += 1;
      },
    );

    await batch.commit();

    /*
     * Los campos de relación fueron eliminados o
     * convertidos a null, así que los documentos
     * procesados dejarán de coincidir.
     */
    if (
      snapshot.size <
      BATCH_LIMIT
    ) {
      break;
    }
  }

  return totalUpdated;
}

export default async function anonymizeApprovedPlacesByUserService({
  uid,
}) {
  if (
    typeof uid !== "string" ||
    !uid.trim()
  ) {
    throw new Error(
      "Se requiere un uid válido para anonimizar los lugares.",
    );
  }

  const normalizedUid =
    uid.trim();

  const processedPlaceIds =
    new Set();

  const protectedStoragePaths =
    new Set();

  let totalUpdated = 0;

  totalUpdated +=
    await anonymizePlacesQuery({
      query: db
        .collection("places")
        .where(
          "createdBy",
          "==",
          normalizedUid,
        ),

      uid: normalizedUid,
      processedPlaceIds,
      protectedStoragePaths,
    });

  totalUpdated +=
    await anonymizePlacesQuery({
      query: db
        .collection("places")
        .where(
          "createdByUid",
          "==",
          normalizedUid,
        ),

      uid: normalizedUid,
      processedPlaceIds,
      protectedStoragePaths,
    });

  totalUpdated +=
    await anonymizePlacesQuery({
      query: db
        .collection("places")
        .where(
          "userId",
          "==",
          normalizedUid,
        ),

      uid: normalizedUid,
      processedPlaceIds,
      protectedStoragePaths,
    });

  /*
   * Algunos lugares provenientes de submissions
   * podrían relacionarse solamente mediante
   * origin.submittedBy.
   */
  totalUpdated +=
    await anonymizePlacesQuery({
      query: db
        .collection("places")
        .where(
          "origin.submittedBy",
          "==",
          normalizedUid,
        ),

      uid: normalizedUid,
      processedPlaceIds,
      protectedStoragePaths,
    });

  return {
    totalUpdated,

    /*
     * Estas rutas no se deben borrar porque todavía
     * son utilizadas por lugares publicados.
     */
    protectedStoragePaths: [
      ...protectedStoragePaths,
    ],
  };
}