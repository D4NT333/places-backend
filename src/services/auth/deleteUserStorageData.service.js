import { bucket } from "../../config/firebase.js";

async function deleteFilesByPrefix(prefix) {
  if (!bucket) {
    console.warn("Storage bucket no configurado. Se omite borrado de archivos.");
    return 0;
  }

  const [files] = await bucket.getFiles({ prefix });

  if (!files.length) {
    return 0;
  }

  await Promise.all(
    files.map((file) =>
      file.delete().catch((error) => {
        console.error(`No se pudo borrar archivo ${file.name}:`, error.message);
        return null;
      })
    )
  );

  return files.length;
}

export default async function deleteUserStorageDataService({ uid }) {
  const prefixes = [
    `users/${uid}/`,
    `user/${uid}/`,

    `placeSubmissions/${uid}/`,
    `placesSubmissions/${uid}/`,
    `place-submissions/${uid}/`,
    `submissions/${uid}/`,

    `photos/${uid}/`,
    `images/${uid}/`,
  ];

  const deletedByPrefix = {};
  let totalFilesDeleted = 0;

  for (const prefix of prefixes) {
    const count = await deleteFilesByPrefix(prefix);

    deletedByPrefix[prefix] = count;
    totalFilesDeleted += count;
  }

  return {
    totalFilesDeleted,
    deletedByPrefix,
  };
}