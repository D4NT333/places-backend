import { db } from "../../../../config/firebase.js";

const VISIBLE_STATUSES = [
  "in_review",
  "pending",
  "returned",
  "resubmitted",
  "rejected",
  "approved",
];

function formatFirestoreDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function getPhotoUrl(
  photo,
  preferredSize = "thumbnail"
) {
  if (!photo) return null;

  if (typeof photo === "string") {
    return photo;
  }

  if (preferredSize === "thumbnail") {
    return (
      photo.thumbnailUrl ||
      photo.thumbnail?.url ||
      photo.displayUrl ||
      photo.mediumUrl ||
      photo.medium?.url ||
      photo.originalUrl ||
      photo.original?.url ||
      photo.thumbnailURL ||
      photo.mediumURL ||
      photo.downloadURL ||
      photo.url ||
      photo.imageUrl ||
      photo.photoUrl ||
      photo.uri ||
      photo.src ||
      null
    );
  }

  if (preferredSize === "medium") {
    return (
      photo.displayUrl ||
      photo.mediumUrl ||
      photo.medium?.url ||
      photo.originalUrl ||
      photo.original?.url ||
      photo.thumbnailUrl ||
      photo.thumbnail?.url ||
      photo.mediumURL ||
      photo.downloadURL ||
      photo.thumbnailURL ||
      photo.url ||
      photo.imageUrl ||
      photo.photoUrl ||
      photo.uri ||
      photo.src ||
      null
    );
  }

  return (
    photo.originalUrl ||
    photo.original?.url ||
    photo.downloadURL ||
    photo.displayUrl ||
    photo.mediumUrl ||
    photo.medium?.url ||
    photo.thumbnailUrl ||
    photo.thumbnail?.url ||
    photo.mediumURL ||
    photo.thumbnailURL ||
    photo.url ||
    photo.imageUrl ||
    photo.photoUrl ||
    photo.uri ||
    photo.src ||
    null
  );
}

function getFirstPhotoUrl(
  photos = [],
  preferredSize = "thumbnail"
) {
  if (
    !Array.isArray(photos) ||
    photos.length === 0
  ) {
    return null;
  }

  return getPhotoUrl(
    photos[0],
    preferredSize
  );
}

function getThumbnailUrl(data) {
  if (!data) return null;

  return (
    data.thumbnailUrl ||
    data.thumbnailPhotoUrl ||
    data.coverPhotoUrl ||
    getFirstPhotoUrl(
      data.photos,
      "thumbnail"
    ) ||
    getFirstPhotoUrl(
      data.images,
      "thumbnail"
    ) ||
    getFirstPhotoUrl(
      data.photoUrls,
      "thumbnail"
    ) ||
    null
  );
}

function normalizeDisplayLabels(labels, ids) {
  if (Array.isArray(labels) && labels.length > 0) {
    return labels
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (Array.isArray(ids)) {
    return ids
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mapSubmissionDoc(doc) {
  const data = doc.data();

  const subtagLabels = normalizeDisplayLabels(
  data.subtagLabels,
  data.subtags
);

const approachLabels = normalizeDisplayLabels(
  data.approachLabels,
  data.approaches
);

  return {
    id:
      data.placeSubmissionId ||
      doc.id,

    name:
      data.name ||
      "Lugar sin nombre",

    imageUrl:
      getThumbnailUrl(data),

    tagId:
      data.tagId ||
      null,

    tag:
      data.tagLabel ||
      "Sin categoría",

    subtagIds:
  Array.isArray(data.subtags)
    ? data.subtags
    : [],

subtags: subtagLabels,

approachIds:
  Array.isArray(data.approaches)
    ? data.approaches
    : [],

approaches: approachLabels,

    price:
      data.price ||
      null,

    status:
      data.status ||
      "in_review",

    createdAt:
      formatFirestoreDate(
        data.createdAt
      ),

    updatedAt:
      formatFirestoreDate(
        data.updatedAt
      ),

    returnedAt:
      formatFirestoreDate(
        data.returnedAt
      ),

    resubmittedAt:
      formatFirestoreDate(
        data.resubmittedAt
      ),
  };
}

export default async function getMyPlaceSubmissionsService({
  uid,
  limit = 10,
  cursor = null,
}) {
  if (!uid) {
    throw new Error(
      "Falta uid para obtener propuestas del usuario."
    );
  }

  const parsedLimit = Number(limit);

  const safeLimit = Math.min(
    Number.isFinite(parsedLimit)
      ? parsedLimit
      : 10,
    20
  );

  let query = db
    .collection(
      "placeSubmissions"
    )
    .where(
      "createdBy",
      "==",
      uid
    )
    .where(
      "status",
      "in",
      VISIBLE_STATUSES
    )
    .orderBy(
      "createdAt",
      "desc"
    )
    .limit(
      safeLimit + 1
    );

  if (cursor) {
    const cursorDate =
      new Date(cursor);

    if (
      !Number.isNaN(
        cursorDate.getTime()
      )
    ) {
      query = query.startAfter(
        cursorDate
      );
    }
  }

  const snapshot =
    await query.get();

  const docs =
    snapshot.docs;

  const hasMore =
    docs.length > safeLimit;

  const visibleDocs =
    hasMore
      ? docs.slice(
          0,
          safeLimit
        )
      : docs;

  const items =
    visibleDocs.map(
      mapSubmissionDoc
    );

  const lastItem =
    items[
      items.length - 1
    ];

  return {
    items,

    nextCursor:
      hasMore
        ? lastItem?.createdAt ||
          null
        : null,

    hasMore,
  };
}