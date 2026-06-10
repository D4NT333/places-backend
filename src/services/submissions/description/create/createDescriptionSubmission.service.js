import { db, FieldValue } from "../../../../config/firebase.js";

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const MIN_DESCRIPTION_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 200;

async function findPlaceDocByAnyId(transaction, placeId) {
  const cleanPlaceId = cleanText(placeId);

  if (!cleanPlaceId) return null;

  const placesRef = db.collection("places");

  const directRef = placesRef.doc(cleanPlaceId);
  const directSnap = await transaction.get(directRef);

  if (directSnap.exists) {
    return {
      placeRef: directRef,
      placeSnap: directSnap,
    };
  }

  const byPlaceIdQuery = placesRef
    .where("placeId", "==", cleanPlaceId)
    .limit(1);

  const byPlaceIdSnap = await transaction.get(byPlaceIdQuery);

  if (!byPlaceIdSnap.empty) {
    const doc = byPlaceIdSnap.docs[0];

    return {
      placeRef: doc.ref,
      placeSnap: doc,
    };
  }

  const byGooglePlaceIdQuery = placesRef
    .where("origin.googlePlaceId", "==", cleanPlaceId)
    .limit(1);

  const byGooglePlaceIdSnap = await transaction.get(byGooglePlaceIdQuery);

  if (!byGooglePlaceIdSnap.empty) {
    const doc = byGooglePlaceIdSnap.docs[0];

    return {
      placeRef: doc.ref,
      placeSnap: doc,
    };
  }

  return null;
}

export default async function createDescriptionSubmissionService({
  placeId,
  proposedDescription,
  user,
}) {
  const cleanPlaceId = cleanText(placeId);
  const cleanProposedDescription = cleanText(proposedDescription);

  if (!user?.uid) {
    throw createHttpError("Usuario no autenticado.", 401);
  }

  if (!cleanPlaceId) {
    throw createHttpError("El lugar es obligatorio.", 400);
  }

  if (!cleanProposedDescription) {
    throw createHttpError("La descripción propuesta es obligatoria.", 400);
  }

  if (cleanProposedDescription.length < MIN_DESCRIPTION_LENGTH) {
    throw createHttpError(
      `La descripción debe tener al menos ${MIN_DESCRIPTION_LENGTH} caracteres.`,
      400
    );
  }

  if (cleanProposedDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw createHttpError(
      `La descripción no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres.`,
      400
    );
  }

  const submissionsRef = db.collection("descriptionSubmissions");
  const submissionRef = submissionsRef.doc();

  const result = await db.runTransaction(async (transaction) => {
    console.log("CREATE DESCRIPTION SUBMISSION - ID recibido:", cleanPlaceId);

    const placeResult = await findPlaceDocByAnyId(transaction, cleanPlaceId);

    if (!placeResult) {
      throw createHttpError(
        `El lugar no existe. ID recibido: ${cleanPlaceId}`,
        404
      );
    }

    const { placeRef, placeSnap } = placeResult;
    const place = placeSnap.data();

    const realPlaceId = cleanText(place.placeId) || placeSnap.id;

    console.log("PLACE ENCONTRADO:", {
      docId: placeSnap.id,
      placeId: realPlaceId,
      name: place.name,
      status: place.status,
    });

    if (cleanText(place.status) !== "published") {
      throw createHttpError(
        "Solo se pueden proponer descripciones para lugares publicados.",
        400
      );
    }

    const currentDescription = cleanText(place.description);

    if (cleanProposedDescription === currentDescription) {
      throw createHttpError(
        "La descripción propuesta no puede ser igual a la descripción actual.",
        400
      );
    }

    const activeSubmissionQuery = submissionsRef
      .where("placeId", "==", realPlaceId)
      .where("createdBy.uid", "==", user.uid)
      .where("status", "==", "in_review")
      .limit(1);

    const activeSubmissionSnap = await transaction.get(activeSubmissionQuery);

    if (!activeSubmissionSnap.empty) {
      throw createHttpError(
        "Ya tienes una propuesta de descripción en revisión para este lugar.",
        409
      );
    }

    const now = FieldValue.serverTimestamp();

    const submissionData = {
      submissionId: submissionRef.id,

      type: "description",
      status: "in_review",

      placeId: realPlaceId,
      placeDocId: placeSnap.id,
      placeName: cleanText(place.name) || "Lugar sin nombre",

      placeSnapshot: {
        name: cleanText(place.name) || "Lugar sin nombre",
        address: cleanText(place.address),
        mainPhoto: place.mainPhoto || null,
        tagId: cleanText(place.tagId),
        tagLabel: cleanText(place.tagLabel),
        subtags: Array.isArray(place.subtags) ? place.subtags : [],
        approaches: Array.isArray(place.approaches) ? place.approaches : [],
      },

      currentDescription,
      proposedDescription: cleanProposedDescription,

      createdBy: {
        uid: user.uid,
        email: user.email || null,
        name: user.name || null,
        picture: user.picture || null,
      },

      reviewedBy: null,
      reviewedAt: null,
      reviewMessage: null,

      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    transaction.set(submissionRef, submissionData);

    transaction.update(placeRef, {
      "metrics.descriptionProposalsCount": FieldValue.increment(1),
      updatedAt: now,
    });

    return {
      submissionId: submissionRef.id,
      ...submissionData,
    };
  });

  return result;
}