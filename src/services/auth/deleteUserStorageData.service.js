import {
  bucket,
} from "../../config/firebase.js";

function normalizeStoragePath(
  value,
) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/^\/+/, "")
    : "";
}

function createProtectedPathsSet(
  protectedStoragePaths,
) {
  return new Set(
    (
      Array.isArray(
        protectedStoragePaths,
      )
        ? protectedStoragePaths
        : []
    )
      .map(normalizeStoragePath)
      .filter(Boolean),
  );
}

async function deleteFilesByPrefix({
  prefix,
  protectedPaths,
}) {
  if (!bucket) {
    console.warn(
      "Storage bucket no configurado. Se omite borrado de archivos.",
    );

    return {
      matched: 0,
      protected: 0,
      deleted: 0,
      failed: 0,
    };
  }

  const [files] =
    await bucket.getFiles({
      prefix,
    });

  if (!files.length) {
    return {
      matched: 0,
      protected: 0,
      deleted: 0,
      failed: 0,
    };
  }

  const filesToDelete = [];
  let protectedCount = 0;

  files.forEach((file) => {
    const filePath =
      normalizeStoragePath(
        file.name,
      );

    if (
      protectedPaths.has(filePath)
    ) {
      protectedCount += 1;
      return;
    }

    filesToDelete.push(file);
  });

  if (!filesToDelete.length) {
    return {
      matched: files.length,
      protected: protectedCount,
      deleted: 0,
      failed: 0,
    };
  }

  let deleted = 0;
  let failed = 0;

  const results =
    await Promise.allSettled(
      filesToDelete.map((file) =>
        file.delete({
          ignoreNotFound: true,
        }),
      ),
    );

  results.forEach(
    (result, index) => {
      if (
        result.status ===
        "fulfilled"
      ) {
        deleted += 1;
        return;
      }

      failed += 1;

      console.error(
        `No se pudo borrar archivo ${filesToDelete[index].name}:`,
        result.reason?.message ||
          result.reason,
      );
    },
  );

  return {
    matched: files.length,
    protected: protectedCount,
    deleted,
    failed,
  };
}

export default async function deleteUserStorageDataService({
  uid,
  protectedStoragePaths = [],
}) {
  if (
    typeof uid !== "string" ||
    !uid.trim()
  ) {
    throw new Error(
      "Se requiere un uid válido para borrar los archivos del usuario.",
    );
  }

  const normalizedUid =
    uid.trim();

  const protectedPaths =
    createProtectedPathsSet(
      protectedStoragePaths,
    );

  const prefixes = [
    `users/${normalizedUid}/`,
    `user/${normalizedUid}/`,

    /*
     * Podemos revisar submissions porque ahora
     * las imágenes utilizadas por lugares publicados
     * están protegidas individualmente.
     */
    `submissions/${normalizedUid}/`,

    `placeSubmissions/${normalizedUid}/`,
    `placesSubmissions/${normalizedUid}/`,
    `place-submissions/${normalizedUid}/`,

    `photoSubmissions/${normalizedUid}/`,
    `photosSubmissions/${normalizedUid}/`,
    `photo-submissions/${normalizedUid}/`,

    `descriptionSubmissions/${normalizedUid}/`,
    `description-submissions/${normalizedUid}/`,

    `photos/${normalizedUid}/`,
    `images/${normalizedUid}/`,

    `profilePhotos/${normalizedUid}/`,
    `profile-photos/${normalizedUid}/`,
  ];

  const deletedByPrefix = {};

  let totalMatched = 0;
  let totalProtected = 0;
  let totalFilesDeleted = 0;
  let totalFilesFailed = 0;

  for (const prefix of prefixes) {
    const result =
      await deleteFilesByPrefix({
        prefix,
        protectedPaths,
      });

    deletedByPrefix[prefix] =
      result;

    totalMatched +=
      result.matched;

    totalProtected +=
      result.protected;

    totalFilesDeleted +=
      result.deleted;

    totalFilesFailed +=
      result.failed;
  }

  return {
    totalMatched,
    totalProtected,
    totalFilesDeleted,
    totalFilesFailed,
    deletedByPrefix,
  };
}