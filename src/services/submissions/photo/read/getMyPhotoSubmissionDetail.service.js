import { db } from "../../../../config/firebase.js";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

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

function timestampToISOString(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate === "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeSubtag(value) {
  if (typeof value === "string") {
    return {
      subtagId: cleanString(value),
      subtagLabel: "",
    };
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const subtagId =
    cleanString(value.subtagId) ||
    cleanString(value.id);

  const subtagLabel =
    cleanString(value.subtagLabel) ||
    cleanString(value.label);

  if (!subtagId && !subtagLabel) {
    return null;
  }

  return {
    subtagId,
    subtagLabel,
  };
}

function normalizeApproach(value) {
  if (typeof value === "string") {
    return {
      approachId: cleanString(value),
      approachLabel: "",
    };
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const approachId =
    cleanString(value.approachId) ||
    cleanString(value.id);

  const approachLabel =
    cleanString(
      value.approachLabel
    ) ||
    cleanString(value.label);

  if (
    !approachId &&
    !approachLabel
  ) {
    return null;
  }

  return {
    approachId,
    approachLabel,
  };
}

function normalizeMediumPhoto(
  photo,
  index
) {
  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return null;
  }

  const mediumUrl = cleanString(
    photo?.medium?.url
  );

  if (!mediumUrl) {
    return null;
  }

  return {
    photoId:
      cleanString(photo.photoId) ||
      `photo-${index}`,

    order:
      Number.isInteger(photo.order)
        ? photo.order
        : index,

    mediumUrl,

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

    mimeType:
      cleanString(
        photo?.medium?.mimeType
      ),
  };
}

export default async function getMyPhotoSubmissionDetailService({
  submissionId,
  userId,
}) {
  const normalizedSubmissionId =
    cleanString(submissionId);

  const normalizedUserId =
    cleanString(userId);

  if (!normalizedUserId) {
    throw createServiceError(
      "No se encontró un usuario autenticado.",
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
    .doc(normalizedSubmissionId);

  const submissionSnapshot =
    await submissionReference.get();

  if (!submissionSnapshot.exists) {
    throw createServiceError(
      "No se encontró la propuesta de fotografías.",
      404
    );
  }

  const submissionData =
    submissionSnapshot.data() || {};

  /*
   * Usamos 404 también cuando no pertenece
   * al usuario para no revelar propuestas
   * de otras personas.
   */
  if (
    cleanString(
      submissionData.createdBy
    ) !== normalizedUserId
  ) {
    throw createServiceError(
      "No se encontró la propuesta de fotografías.",
      404
    );
  }

  const photos = Array.isArray(
    submissionData.photos
  )
    ? submissionData.photos
        .map(
          (
            photo,
            index
          ) =>
            normalizeMediumPhoto(
              photo,
              index
            )
        )
        .filter(Boolean)
        .sort(
          (
            firstPhoto,
            secondPhoto
          ) =>
            firstPhoto.order -
            secondPhoto.order
        )
    : [];

  const subtags = Array.isArray(
    submissionData.subtags
  )
    ? submissionData.subtags
        .map(normalizeSubtag)
        .filter(Boolean)
    : [];

  const approaches = Array.isArray(
    submissionData.approaches
  )
    ? submissionData.approaches
        .map(normalizeApproach)
        .filter(Boolean)
    : [];

  return {
    id: submissionSnapshot.id,

    submissionId:
      cleanString(
        submissionData.submissionId
      ) ||
      submissionSnapshot.id,

    placeId:
      cleanString(
        submissionData.placeId
      ),

    placeName:
      cleanString(
        submissionData.placeName
      ) ||
      "Lugar sin nombre",

    tagId:
      cleanString(
        submissionData.tagId
      ),

    tagLabel:
      cleanString(
        submissionData.tagLabel
      ),

    subtags,

    approaches,

    /*
     * Este status siempre será el estado
     * actual guardado en Firestore.
     */
    status:
      cleanString(
        submissionData.status
      ) ||
      "in_review",

    photoCount:
      Number.isInteger(
        submissionData.photoCount
      )
        ? submissionData.photoCount
        : photos.length,

    photos,

    createdAt:
      timestampToISOString(
        submissionData.createdAt
      ),

    updatedAt:
      timestampToISOString(
        submissionData.updatedAt
      ),

    approvedAt:
      timestampToISOString(
        submissionData.approvedAt
      ),

    rejectedAt:
      timestampToISOString(
        submissionData.rejectedAt
      ),

    rejectionReason:
      submissionData.rejectionReason ||
      null,
  };
}