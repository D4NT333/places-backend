import {
  FieldPath,
  Timestamp,
} from "firebase-admin/firestore";

import {
  auth,
  db,
} from "../../../config/firebase.js";

const PLACES_COLLECTION = "places";
const USERS_COLLECTION = "user";
const ADMIN_USERS_COLLECTION = "adminUsers";

const MODERATION_STATUSES = new Set([
  "all",
  "published",
  "in_review",
  "warned",
  "hidden",
]);

const ACTIVITY_STATUSES = new Set([
  "all",
  "active",
  "low_activity",
  "pending",
  "inactive",
]);

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

function createServiceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeLimit(value) {
  const parsedLimit = Number(value);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsedLimit, MAX_LIMIT);
}

function timestampToISOString(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function encodeCursor({ createdAt, placeId }) {
  if (!createdAt || !placeId) {
    return null;
  }

  if (typeof createdAt.toMillis !== "function") {
    return null;
  }

  const payload = {
    createdAtMs: createdAt.toMillis(),
    placeId,
  };

  return Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const decodedCursor = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );

    if (
      !Number.isFinite(decodedCursor.createdAtMs) ||
      typeof decodedCursor.placeId !== "string" ||
      !decodedCursor.placeId.trim()
    ) {
      throw new Error("Cursor inválido");
    }

    return {
      createdAt: Timestamp.fromMillis(
        decodedCursor.createdAtMs
      ),
      placeId: decodedCursor.placeId,
    };
  } catch {
    throw createServiceError(
      "El cursor de paginación no es válido.",
      400
    );
  }
}

function getInitials(name) {
  if (!name) {
    return "LG";
  }

  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "LG";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getDisplayName(data) {
  if (!data) {
    return null;
  }

  return (
    data.name ||
    data.displayName ||
    data.fullName ||
    data.username ||
    data.email ||
    null
  );
}

function normalizeUserIds(userIds) {
  return [
    ...new Set(
      userIds
        .filter(
          (userId) =>
            typeof userId === "string" &&
            userId.trim()
        )
        .map((userId) => userId.trim())
        .filter(
          (userId) =>
            userId !== "admin_panel" &&
            userId !== "admin_uid_or_system"
        )
    ),
  ];
}

async function getAuthenticationUsersMap(
  userIds,
) {
  if (
    !Array.isArray(userIds) ||
    userIds.length === 0
  ) {
    return new Map();
  }

  const result =
    await auth.getUsers(
      userIds.map(
        (uid) => ({
          uid,
        }),
      ),
    );

  const authenticationUsersMap =
    new Map();

  result.users.forEach(
    (userRecord) => {
      authenticationUsersMap.set(
        userRecord.uid,
        userRecord,
      );
    },
  );

  return authenticationUsersMap;
}

async function getPeopleByIds(
  userIds,
) {
  const normalizedIds =
    normalizeUserIds(
      userIds,
    );

  if (
    normalizedIds.length === 0
  ) {
    return new Map();
  }

  const userReferences =
    normalizedIds.map(
      (userId) =>
        db
          .collection(
            USERS_COLLECTION,
          )
          .doc(
            userId,
          ),
    );

  const adminReferences =
    normalizedIds.map(
      (userId) =>
        db
          .collection(
            ADMIN_USERS_COLLECTION,
          )
          .doc(
            userId,
          ),
    );

  const [
    userSnapshots,
    adminSnapshots,
    authenticationUsersMap,
  ] = await Promise.all([
    db.getAll(
      ...userReferences,
    ),

    db.getAll(
      ...adminReferences,
    ),

    getAuthenticationUsersMap(
      normalizedIds,
    ),
  ]);

  const peopleMap =
    new Map();

  userSnapshots.forEach(
    (snapshot) => {
      if (
        !snapshot.exists
      ) {
        return;
      }

      const data =
        snapshot.data() ||
        {};

      const authenticationUser =
        authenticationUsersMap.get(
          snapshot.id,
        );

      const displayName =
        getDisplayName(
          data,
        ) ||
        authenticationUser
          ?.displayName ||
        "Usuario";

      const photoURL =
        data.photoURL ||
        authenticationUser
          ?.photoURL ||
        null;

      peopleMap.set(
        snapshot.id,
        {
          uid:
            snapshot.id,

          name:
            displayName,

          photoURL,

          type:
            "user",
        },
      );
    },
  );

  adminSnapshots.forEach(
    (snapshot) => {
      if (
        !snapshot.exists
      ) {
        return;
      }

      const data =
        snapshot.data() ||
        {};

      const authenticationUser =
        authenticationUsersMap.get(
          snapshot.id,
        );

      const displayName =
        getDisplayName(
          data,
        ) ||
        authenticationUser
          ?.displayName ||
        "Administrador";

      const photoURL =
        data.photoURL ||
        authenticationUser
          ?.photoURL ||
        null;

      peopleMap.set(
        snapshot.id,
        {
          uid:
            snapshot.id,

          name:
            displayName,

          photoURL,

          type:
            "admin",
        },
      );
    },
  );

  return peopleMap;
}

function resolvePerson({
  userId,
  peopleMap,
  fallbackName,
}) {
  if (!userId) {
    return {
      uid:
        null,

      name:
        fallbackName,

      photoURL:
        null,

      type:
        null,
    };
  }

  if (
    userId ===
      "admin_panel" ||
    userId ===
      "admin_uid_or_system"
  ) {
    return {
      uid:
        userId,

      name:
        "Administrador",

      photoURL:
        null,

      type:
        "admin",
    };
  }

  return (
    peopleMap.get(
      userId,
    ) || {
      uid:
        userId,

      name:
        fallbackName,

      photoURL:
        null,

      type:
        null,
    }
  );
}

function getCreatedById(place) {
  return (
    place.createdBy ||
    place.origin?.submittedBy ||
    place.origin?.approvedBy ||
    null
  );
}

function getApprovedById(place) {
  return (
    place.origin?.approvedBy ||
    place.approvedBy ||
    null
  );
}

function getPublicApiUrl() {
  const publicApiUrl =
    process.env.PUBLIC_API_URL?.trim();

  if (!publicApiUrl) {
    return "";
  }

  return publicApiUrl.replace(
    /\/+$/,
    "",
  );
}

function buildGooglePhotoUrl(
  photoReference,
) {
  if (
    typeof photoReference !== "string" ||
    !photoReference.trim()
  ) {
    return null;
  }

  const encodedReference =
    encodeURIComponent(
      photoReference.trim(),
    );

  const relativeUrl =
    `/api/places/feed-photo/google?reference=${encodedReference}&maxWidthPx=240`;

  const publicApiUrl =
    getPublicApiUrl();

  return publicApiUrl
    ? `${publicApiUrl}${relativeUrl}`
    : relativeUrl;
}

function getMainPhotoUrl(place) {
  const directUrl =
    place.mainPhoto?.url ||
    place.mainPhoto?.medium?.url ||
    place.mainPhoto?.thumbnail?.url ||
    place.photos?.[0]?.url ||
    place.photos?.[0]?.medium?.url ||
    place.photos?.[0]?.thumbnail?.url ||
    null;

  if (directUrl) {
    return directUrl;
  }

  const googlePhotoReference =
    place.mainPhoto?.reference ||
    place.photos?.[0]?.reference ||
    null;

  if (googlePhotoReference) {
    return buildGooglePhotoUrl(
      googlePhotoReference,
    );
  }

  return null;
}
export default async function getAdminPlacesService({
  limit,
  cursor,
  moderationStatus = "all",
  activityStatus = "all",
}) {
  const normalizedLimit = normalizeLimit(limit);

  if (!MODERATION_STATUSES.has(moderationStatus)) {
    throw createServiceError(
      "El estado de moderación no es válido.",
      400
    );
  }

  if (!ACTIVITY_STATUSES.has(activityStatus)) {
    throw createServiceError(
      "El estado de actividad no es válido.",
      400
    );
  }

  const decodedCursor = decodeCursor(cursor);

  let query = db.collection(PLACES_COLLECTION);

  if (moderationStatus !== "all") {
    query = query.where(
      "status",
      "==",
      moderationStatus
    );
  }

  if (activityStatus !== "all") {
    query = query.where(
      "activityStatus",
      "==",
      activityStatus
    );
  }

  query = query
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");

  if (decodedCursor) {
    query = query.startAfter(
      decodedCursor.createdAt,
      decodedCursor.placeId
    );
  }

  const snapshot = await query
    .limit(normalizedLimit + 1)
    .get();

  const hasMore =
    snapshot.docs.length > normalizedLimit;

  const visibleDocuments = snapshot.docs.slice(
    0,
    normalizedLimit
  );

  const peopleIds = [];

  visibleDocuments.forEach((document) => {
    const place = document.data();

    const createdById = getCreatedById(place);
    const approvedById = getApprovedById(place);

    if (createdById) {
      peopleIds.push(createdById);
    }

    if (approvedById) {
      peopleIds.push(approvedById);
    }
  });

  const peopleMap = await getPeopleByIds(peopleIds);

  const places = visibleDocuments.map((document) => {
    const place = document.data();

    const createdById = getCreatedById(place);
    const approvedById = getApprovedById(place);

    const name =
      typeof place.name === "string" &&
      place.name.trim()
        ? place.name.trim()
        : "Lugar sin nombre";

    const createdBy = resolvePerson({
      userId: createdById,
      peopleMap,
      fallbackName: "Sin información",
    });

    const approvedBy = resolvePerson({
      userId: approvedById,
      peopleMap,
      fallbackName: "Sin aceptar",
    });

    return {
      id: document.id,
      placeId: place.placeId || document.id,

      name,
      initials: getInitials(name),
      imageUrl: getMainPhotoUrl(place),

      createdAt: timestampToISOString(
        place.createdAt
      ),

      updatedAt: timestampToISOString(
        place.updatedAt
      ),

      createdBy,
      approvedBy,

      moderationStatus:
        place.status || null,

      activityStatus:
        place.activityStatus || null,

      source:
        place.origin?.type ||
        place.source ||
        null,
    };
  });

  const lastDocument =
    visibleDocuments.length > 0
      ? visibleDocuments[
          visibleDocuments.length - 1
        ]
      : null;

  const lastDocumentData =
    lastDocument?.data();

  const nextCursor =
    hasMore &&
    lastDocument &&
    lastDocumentData?.createdAt
      ? encodeCursor({
          createdAt:
            lastDocumentData.createdAt,
          placeId: lastDocument.id,
        })
      : null;

  return {
    places,
    nextCursor,
    hasMore,
    loadedCount: places.length,
  };
}