import {
  FieldPath,
} from "firebase-admin/firestore";

import { db } from "../../../config/firebase.js";

import {
  decodeCursor,
  encodeCursor,
  getDateMillis,
  millisToTimestamp,
  serializeDate,
} from "../../../utils/firestorePagination.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const ALLOWED_TYPES = new Set([
  "all",
  "description",
  "photo",
]);

function createHttpError(message, statusCode) {
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
    MAX_LIMIT,
  );
}

function getStatusLabel(status) {
  const labels = {
    in_review: "Pendiente",
    pending: "Pendiente",
    approved: "Aceptado",
    accepted: "Aceptado",
    rejected: "Rechazado",
    returned: "Devuelto",
    resubmitted: "Corregido",
    pending_delete: "Pendiente de eliminación",
  };

  return labels[status] || status || "Desconocido";
}

function getSubmissionUser(submission) {
  const source =
    submission.createdBy ||
    submission.user ||
    submission.submittedBy ||
    {};

  if (typeof source === "string") {
    return {
      uid: source,
      name:
        submission.userName ||
        submission.createdByName ||
        "Usuario",

      photoURL:
        submission.userPhoto ||
        submission.photoURL ||
        null,
    };
  }

  return {
    uid:
      source.uid ||
      submission.userId ||
      null,

    name:
      source.name ||
      source.displayName ||
      submission.userName ||
      "Usuario",

    photoURL:
      source.photoURL ||
      source.photo ||
      submission.userPhoto ||
      null,
  };
}

function normalizeDescriptionSubmission(snapshot) {
  const submission = snapshot.data();

  const description =
    submission.description ||
    submission.proposedDescription ||
    submission.newDescription ||
    submission.text ||
    "";

  return {
    submissionId:
      submission.submissionId ||
      snapshot.id,

    placeId: submission.placeId || null,
    placeName: submission.placeName || null,

    type: "description",
    typeLabel: "Descripción",

    status: submission.status || "in_review",

    statusLabel: getStatusLabel(
      submission.status,
    ),

    user: getSubmissionUser(submission),

    preview: {
      text: description,
    },

    createdAt: serializeDate(
      submission.createdAt,
    ),

    updatedAt: serializeDate(
      submission.updatedAt,
    ),

    approvedAt: serializeDate(
      submission.approvedAt,
    ),

    rejectedAt: serializeDate(
      submission.rejectedAt,
    ),

    deletedAt: serializeDate(
      submission.deletedAt,
    ),

    sortDate: getDateMillis(
      submission.createdAt,
    ),

    documentId: snapshot.id,
  };
}

function normalizePhotoSubmission(snapshot) {
  const submission = snapshot.data();

  const photos = Array.isArray(submission.photos)
    ? submission.photos
    : [];

  return {
    submissionId:
      submission.submissionId ||
      snapshot.id,

    placeId: submission.placeId || null,
    placeName: submission.placeName || null,

    type: "photo",
    typeLabel: "Fotografías",

    status: submission.status || "in_review",

    statusLabel: getStatusLabel(
      submission.status,
    ),

    user: getSubmissionUser(submission),

    preview: {
      thumbnailUrl:
        submission.thumbnailUrl ||
        photos[0]?.thumbnailUrl ||
        photos[0]?.mediumUrl ||
        photos[0]?.url ||
        null,

      photoCount:
        Number(submission.photoCount) ||
        photos.length,
    },

    createdAt: serializeDate(
      submission.createdAt,
    ),

    updatedAt: serializeDate(
      submission.updatedAt,
    ),

    approvedAt: serializeDate(
      submission.approvedAt,
    ),

    rejectedAt: serializeDate(
      submission.rejectedAt,
    ),

    deletedAt: serializeDate(
      submission.deletedAt,
    ),

    sortDate: getDateMillis(
      submission.createdAt,
    ),

    documentId: snapshot.id,
  };
}

function createCollectionQuery({
  collectionName,
  placeId,
  limit,
  cursor,
}) {
  let query = db
    .collection(collectionName)
    .where("placeId", "==", placeId)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(limit + 1);

  if (cursor) {
    query = query.startAfter(
      millisToTimestamp(cursor.createdAt),
      cursor.id,
    );
  }

  return query;
}

function createSourceCursor(item) {
  if (!item) {
    return null;
  }

  return {
    id: item.documentId,
    createdAt: item.sortDate,
  };
}

function removeInternalFields(item) {
  const {
    sortDate,
    documentId,
    ...publicItem
  } = item;

  return publicItem;
}

export default async function getAdminPlaceSubmissionsService({
  placeId,
  limit,
  cursor,
  type = "all",
}) {
  if (!placeId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  if (!ALLOWED_TYPES.has(type)) {
    throw createHttpError(
      "El tipo de propuesta solicitado no es válido.",
      400,
    );
  }

  const normalizedLimit = normalizeLimit(limit);

  const decodedCursor =
    decodeCursor(cursor) || {};

  const descriptionCursor =
    decodedCursor.description || null;

  const photoCursor =
    decodedCursor.photo || null;

  if (
    descriptionCursor &&
    (!descriptionCursor.id ||
      !descriptionCursor.createdAt)
  ) {
    throw createHttpError(
      "El cursor de propuestas de descripción no es válido.",
      400,
    );
  }

  if (
    photoCursor &&
    (!photoCursor.id ||
      !photoCursor.createdAt)
  ) {
    throw createHttpError(
      "El cursor de propuestas de fotografías no es válido.",
      400,
    );
  }

  const shouldLoadDescriptions =
    type === "all" ||
    type === "description";

  const shouldLoadPhotos =
    type === "all" ||
    type === "photo";

  const [
    descriptionSnapshot,
    photoSnapshot,
  ] = await Promise.all([
    shouldLoadDescriptions
      ? createCollectionQuery({
          collectionName:
            "descriptionSubmissions",

          placeId,
          limit: normalizedLimit,
          cursor: descriptionCursor,
        }).get()
      : Promise.resolve(null),

    shouldLoadPhotos
      ? createCollectionQuery({
          collectionName:
            "photoSubmissions",

          placeId,
          limit: normalizedLimit,
          cursor: photoCursor,
        }).get()
      : Promise.resolve(null),
  ]);

  const descriptions = descriptionSnapshot
    ? descriptionSnapshot.docs.map(
        normalizeDescriptionSubmission,
      )
    : [];

  const photos = photoSnapshot
    ? photoSnapshot.docs.map(
        normalizePhotoSubmission,
      )
    : [];

  const merged = [
    ...descriptions,
    ...photos,
  ].sort((first, second) => {
    if (second.sortDate !== first.sortDate) {
      return second.sortDate - first.sortDate;
    }

    return second.documentId.localeCompare(
      first.documentId,
    );
  });

  const selected =
    merged.slice(0, normalizedLimit);

  const selectedDescriptions =
    selected.filter(
      (item) => item.type === "description",
    );

  const selectedPhotos =
    selected.filter(
      (item) => item.type === "photo",
    );

  const consumedDescriptionCursor =
    createSourceCursor(
      selectedDescriptions[
        selectedDescriptions.length - 1
      ],
    );

  const consumedPhotoCursor =
    createSourceCursor(
      selectedPhotos[
        selectedPhotos.length - 1
      ],
    );

  /*
   * Si en esta página no se consumió ningún documento
   * de una colección, conservamos su cursor anterior.
   */
  const nextDescriptionCursor =
    consumedDescriptionCursor ||
    descriptionCursor ||
    null;

  const nextPhotoCursor =
    consumedPhotoCursor ||
    photoCursor ||
    null;

  const consumedDescriptionCount =
    selectedDescriptions.length;

  const consumedPhotoCount =
    selectedPhotos.length;

  const hasMoreDescriptions =
    shouldLoadDescriptions &&
    descriptions.length >
      consumedDescriptionCount;

  const hasMorePhotos =
    shouldLoadPhotos &&
    photos.length > consumedPhotoCount;

  const hasMore =
    hasMoreDescriptions ||
    hasMorePhotos;

  const nextCursor = hasMore
    ? encodeCursor({
        description:
          nextDescriptionCursor,

        photo:
          nextPhotoCursor,
      })
    : null;

  return {
    submissions:
      selected.map(removeInternalFields),

    pagination: {
      limit: normalizedLimit,
      type,
      nextCursor,
      hasMore,
    },
  };
}