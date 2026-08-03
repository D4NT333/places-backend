import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const CANDIDATES_COLLECTION =
  "candidatesPlaces";

const REJECTED_GOOGLE_PLACES_COLLECTION =
  "rejectedGooglePlaces";

function createHttpError(
  message,
  statusCode = 400,
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
}

async function findCandidateReference({
  candidateId,
}) {
  const candidateReference =
    db
      .collection(
        CANDIDATES_COLLECTION,
      )
      .doc(candidateId);

  const candidateSnapshot =
    await candidateReference.get();

  if (candidateSnapshot.exists) {
    return {
      reference:
        candidateReference,

      snapshot:
        candidateSnapshot,
    };
  }

  /*
   * Normalmente el ID del documento ya es
   * el googlePlaceId.
   *
   * Dejamos esta búsqueda alternativa por si
   * existe algún candidato antiguo cuyo ID
   * de documento sea diferente.
   */
  const candidateQuerySnapshot =
    await db
      .collection(
        CANDIDATES_COLLECTION,
      )
      .where(
        "googlePlaceId",
        "==",
        candidateId,
      )
      .limit(1)
      .get();

  if (
    candidateQuerySnapshot.empty
  ) {
    return null;
  }

  const candidateDocument =
    candidateQuerySnapshot.docs[0];

  return {
    reference:
      candidateDocument.ref,

    snapshot:
      candidateDocument,
  };
}

export default async function rejectGooglePlaceCandidateService({
  candidateId,
  adminUser,
  reason,
}) {
  if (!candidateId) {
    throw createHttpError(
      "El candidateId es obligatorio.",
      400,
    );
  }

  const adminUid =
    adminUser?.uid;

  if (!adminUid) {
    throw createHttpError(
      "No se encontró el administrador autenticado.",
      401,
    );
  }

  const candidateResult =
    await findCandidateReference({
      candidateId,
    });

  if (!candidateResult) {
    throw createHttpError(
      "El candidato no existe.",
      404,
    );
  }

  const {
    reference:
      candidateReference,
  } = candidateResult;

  const normalizedReason =
    typeof reason === "string" &&
    reason.trim()
      ? reason.trim()
      : "not_suitable_for_lsearch";

  const result =
    await db.runTransaction(
      async (transaction) => {
        /*
         * Volvemos a leer dentro de la transacción
         * para evitar que dos administradores
         * modifiquen el mismo candidato al mismo tiempo.
         */
        const candidateSnapshot =
          await transaction.get(
            candidateReference,
          );

        if (
          !candidateSnapshot.exists
        ) {
          throw createHttpError(
            "El candidato ya no existe.",
            404,
          );
        }

        const candidate =
          candidateSnapshot.data();

        const currentStatus =
          candidate.status ||
          "in_review";

        if (
          currentStatus ===
          "accepted"
        ) {
          throw createHttpError(
            "El candidato ya fue aceptado.",
            409,
          );
        }

        if (
          currentStatus ===
          "rejected"
        ) {
          throw createHttpError(
            "El candidato ya fue rechazado.",
            409,
          );
        }

        if (
          currentStatus !==
          "in_review"
        ) {
          throw createHttpError(
            "El candidato no se encuentra pendiente de revisión.",
            409,
          );
        }

        const googlePlaceId =
          candidate.googlePlaceId ||
          candidateReference.id;

        if (!googlePlaceId) {
          throw createHttpError(
            "El candidato no tiene Google Place ID.",
            400,
          );
        }

        /*
         * Utilizamos el Google Place ID como ID del
         * documento para impedir duplicados.
         */
        const rejectedPlaceReference =
          db
            .collection(
              REJECTED_GOOGLE_PLACES_COLLECTION,
            )
            .doc(
              googlePlaceId,
            );

        const now =
          FieldValue.serverTimestamp();

        transaction.update(
          candidateReference,
          {
            status:
              "rejected",

            rejectedAt:
              now,

            rejectedBy:
              adminUid,

            rejectionReason:
              normalizedReason,

            reviewedBy:
              adminUid,

            updatedAt:
              now,
          },
        );

        /*
         * Esta colección no conserva fotos,
         * dirección ni información pesada.
         *
         * Solo registra el identificador necesario
         * para bloquear futuras importaciones.
         */
        transaction.set(
          rejectedPlaceReference,
          {
            googlePlaceId,

            rejectedAt:
              now,

            rejectedBy:
              adminUid,
          },
          {
            merge: true,
          },
        );

        return {
          candidateId:
            candidateReference.id,

          googlePlaceId,

          status:
            "rejected",

          rejectionReason:
            normalizedReason,
        };
      },
    );

  return result;
}