import { db } from "../../../../config/firebase.js";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

const VALID_STATUSES = [
  "in_review",
  "approved",
  "rejected",
];

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeLimit(value) {
  const parsedLimit = Number(value);

  if (!Number.isInteger(parsedLimit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(parsedLimit, 1),
    MAX_LIMIT
  );
}

function timestampToISOString(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeStatus(value) {
  const status =
    typeof value === "string"
      ? value.trim()
      : "all";

  if (!status || status === "all") {
    return "all";
  }

  if (!VALID_STATUSES.includes(status)) {
    throw createServiceError(
      "El estado proporcionado no es válido.",
      400
    );
  }

  return status;
}

function getFirstPhoto(photos) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return null;
  }

  return (
    photos.find(
      (photo) => Number(photo?.order) === 0
    ) ||
    [...photos].sort(
      (firstPhoto, secondPhoto) =>
        Number(firstPhoto?.order ?? 0) -
        Number(secondPhoto?.order ?? 0)
    )[0] ||
    null
  );
}

export default async function getPhotoSubmissionsService({
  status = "all",
  limit = DEFAULT_LIMIT,
  cursor = "",
} = {}) {
  const normalizedStatus =
    normalizeStatus(status);

  const normalizedLimit =
    normalizeLimit(limit);

  const normalizedCursor =
    typeof cursor === "string"
      ? cursor.trim()
      : "";

  const collectionReference = db.collection(
    PHOTO_SUBMISSIONS_COLLECTION
  );

  let query = collectionReference;

  if (normalizedStatus !== "all") {
    query = query.where(
      "status",
      "==",
      normalizedStatus
    );
  }

  query = query.orderBy(
    "createdAt",
    "desc"
  );

  if (normalizedCursor) {
    const cursorDocument =
      await collectionReference
        .doc(normalizedCursor)
        .get();

    if (!cursorDocument.exists) {
      throw createServiceError(
        "El cursor de paginación no es válido.",
        400
      );
    }

    const cursorData =
      cursorDocument.data() || {};

    if (
      normalizedStatus !== "all" &&
      cursorData.status !== normalizedStatus
    ) {
      throw createServiceError(
        "El cursor no pertenece al filtro seleccionado.",
        400
      );
    }

    query = query.startAfter(
      cursorDocument
    );
  }

  /*
   * Se solicita un documento adicional para
   * comprobar si existe otra página.
   */
  const snapshot = await query
    .limit(normalizedLimit + 1)
    .get();

  const hasMore =
    snapshot.docs.length >
    normalizedLimit;

  const pageDocuments = hasMore
    ? snapshot.docs.slice(
        0,
        normalizedLimit
      )
    : snapshot.docs;

  const submissions = pageDocuments.map(
    (document) => {
      const data =
        document.data() || {};

      const firstPhoto =
        getFirstPhoto(data.photos);

      const mediumUrl =
        firstPhoto?.medium?.url || "";

      const mediumPath =
        firstPhoto?.medium?.path || "";

      const thumbnailUrl =
        data.thumbnailUrl ||
        firstPhoto?.thumbnail?.url ||
        "";

      const thumbnailPath =
        data.thumbnailPath ||
        firstPhoto?.thumbnail?.path ||
        "";

      return {
        id: document.id,

        submissionId:
          data.submissionId ||
          document.id,

        placeId:
          data.placeId || "",

        placeName:
          data.placeName ||
          "Lugar sin nombre",

        createdBy:
          data.createdBy || "",

        createdByName:
          data.createdByName ||
          "Usuario",

        status:
          data.status ||
          "in_review",

        photoCount:
          Number.isInteger(
            data.photoCount
          )
            ? data.photoCount
            : Array.isArray(data.photos)
              ? data.photos.length
              : 0,

        /*
         * La tarjeta usará la versión medium.
         * Thumbnail funciona como respaldo.
         */
        imageUrl:
          mediumUrl ||
          thumbnailUrl,

        imagePath:
          mediumPath ||
          thumbnailPath,

        mediumUrl,
        mediumPath,

        thumbnailUrl,
        thumbnailPath,

        createdAt:
          timestampToISOString(
            data.createdAt
          ),

        updatedAt:
          timestampToISOString(
            data.updatedAt
          ),
      };
    }
  );

  const lastDocument =
    pageDocuments[
      pageDocuments.length - 1
    ];

  return {
    submissions,

    pagination: {
      limit: normalizedLimit,
      hasMore,

      nextCursor:
        hasMore && lastDocument
          ? lastDocument.id
          : null,
    },
  };
}