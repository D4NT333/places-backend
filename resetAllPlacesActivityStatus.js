import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  db,
} from "./src/config/firebase.js";

/*
 * Ajusta la ruta del import de db si tu carpeta
 * scripts está ubicada en otro nivel.
 */

const PLACES_COLLECTION =
  "places";

const BATCH_LIMIT =
  450;

async function resetAllPlacesActivityStatus() {
  console.log(
    "Iniciando recuperación de estados de actividad...",
  );

  const snapshot =
    await db
      .collection(
        PLACES_COLLECTION,
      )
      .get();

  if (snapshot.empty) {
    console.log(
      "No existen lugares para actualizar.",
    );

    return;
  }

  let batch =
    db.batch();

  let operations =
    0;

  let updatedCount =
    0;

  for (
    const placeDocument
    of snapshot.docs
  ) {
    const place =
      placeDocument.data();

    /*
     * No tocamos documentos eliminados.
     */
    if (place.deletedAt) {
      continue;
    }

    batch.update(
      placeDocument.ref,
      {
        activityStatus:
          "active",

        confirmationStartedAt:
          null,

        activityStatusUpdatedAt:
          FieldValue
            .serverTimestamp(),

        updatedAt:
          FieldValue
            .serverTimestamp(),
      },
    );

    operations += 1;
    updatedCount += 1;

    /*
     * Firestore permite hasta 500 operaciones
     * por batch. Usamos 450 por seguridad.
     */
    if (
      operations >=
      BATCH_LIMIT
    ) {
      await batch.commit();

      console.log(
        `Se actualizaron ${updatedCount} lugares.`,
      );

      batch =
        db.batch();

      operations =
        0;
    }
  }

  if (
    operations > 0
  ) {
    await batch.commit();
  }

  console.log(
    "Recuperación terminada.",
    {
      updatedCount,
    },
  );
}

resetAllPlacesActivityStatus()
  .then(() => {
    console.log(
      "Todos los lugares quedaron activos.",
    );

    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "Falló la recuperación de lugares.",
      error,
    );

    process.exit(1);
  });