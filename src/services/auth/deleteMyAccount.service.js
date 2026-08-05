import {
  auth,
  db,
  FieldValue,
} from "../../config/firebase.js";

import anonymizeApprovedPlacesByUserService
  from "./anonymizeApprovedPlacesByUser.service.js";

import deleteUserFirestoreDataService
  from "./deleteUserFirestoreData.service.js";

import deleteUserStorageDataService
  from "./deleteUserStorageData.service.js";

export default async function deleteMyAccountService({
  uid,
}) {
  if (
    typeof uid !== "string" ||
    !uid.trim()
  ) {
    throw new Error(
      "Se requiere un uid válido para eliminar la cuenta.",
    );
  }

  const normalizedUid =
    uid.trim();

  const userRef = db
    .collection("user")
    .doc(normalizedUid);

  await userRef.set(
    {
      deletionStatus:
        "processing",

      deletionRequestedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  const deleted = {
    placesAnonymized: null,
    storage: null,
    firestore: null,
    auth: false,
  };

  /*
   * 1. Conserva los lugares publicados,
   * elimina la identidad del usuario y obtiene
   * las rutas de fotos que deben sobrevivir.
   */
  deleted.placesAnonymized =
    await anonymizeApprovedPlacesByUserService({
      uid: normalizedUid,
    });

  /*
   * 2. Borra archivos privados, rechazados,
   * pendientes o abandonados.
   *
   * No borra las imágenes que siguen siendo usadas
   * por lugares publicados.
   */
  deleted.storage =
    await deleteUserStorageDataService({
      uid: normalizedUid,

      protectedStoragePaths:
        deleted
          .placesAnonymized
          .protectedStoragePaths,
    });

  /*
   * Si hubo fallos reales en Storage, detenemos
   * el proceso antes de borrar Firestore y Auth.
   *
   * Así puede reintentarse conservando todavía
   * la información necesaria.
   */
  if (
    deleted.storage
      .totalFilesFailed > 0
  ) {
    await userRef.set(
      {
        deletionStatus:
          "storage_failed",

        deletionFailedAt:
          FieldValue.serverTimestamp(),

        deletionStorageFailures:
          deleted.storage
            .totalFilesFailed,
      },
      {
        merge: true,
      },
    );

    const error = new Error(
      "No fue posible eliminar todos los archivos del usuario.",
    );

    error.statusCode = 500;
    error.deleted = deleted;

    throw error;
  }

  /*
   * 3. Borra submissions, reseñas,
   * interacciones, reportes y user/{uid}.
   */
  deleted.firestore =
    await deleteUserFirestoreDataService({
      uid: normalizedUid,
    });

  /*
   * 4. Firebase Authentication siempre al final.
   */
  await auth.deleteUser(
    normalizedUid,
  );

  deleted.auth = true;

  return {
    deleted,
  };
}