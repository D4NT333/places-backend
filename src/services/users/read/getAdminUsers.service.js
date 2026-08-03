import {
  db,
} from "../../../config/firebase.js";

const USERS_COLLECTION =
  "user";

const PLACE_SUBMISSIONS_COLLECTION =
  "placeSubmissions";

const DESCRIPTION_SUBMISSIONS_COLLECTION =
  "descriptionSubmissions";

const PHOTO_SUBMISSIONS_COLLECTION =
  "photoSubmissions";

const REPORTS_COLLECTION =
  "reports";

const USER_STATUS = {
  ALL: "all",
  ACTIVE: "active",
  UNDER_OBSERVATION: "under_observation",
  WARNED: "warned",
  BLOCKED: "blocked",
};

const DATABASE_USER_STATUS = {
  BANNED: "banned",
};

const ALLOWED_STATUS_FILTERS =
  new Set([
    USER_STATUS.ALL,
    USER_STATUS.ACTIVE,
    USER_STATUS.UNDER_OBSERVATION,
    USER_STATUS.WARNED,
    USER_STATUS.BLOCKED,
  ]);

function serializeDate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    value instanceof Date
  ) {
    return value
      .toISOString();
  }

  return value;
}

function getInitials(
  name = "",
  email = "",
) {
  const cleanName =
    name?.trim();

  if (cleanName) {
    const words =
      cleanName
        .split(" ")
        .filter(Boolean);

    if (
      words.length === 1
    ) {
      return words[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`
      .toUpperCase();
  }

  const cleanEmail =
    email?.trim();

  if (cleanEmail) {
    return cleanEmail
      .replace(/@.*/, "")
      .slice(0, 2)
      .toUpperCase();
  }

  return "US";
}

function normalizeUserStatus(
  status,
) {
  const normalizedStatus =
    String(status || "")
      .trim()
      .toLowerCase();

  if (
    normalizedStatus ===
      "banned" ||
    normalizedStatus ===
      "blocked" ||
    normalizedStatus ===
      "permanently_banned"
  ) {
    return USER_STATUS.BLOCKED;
  }

  if (
    normalizedStatus ===
    USER_STATUS.WARNED
  ) {
    return USER_STATUS.WARNED;
  }

  if (
    normalizedStatus ===
    USER_STATUS.UNDER_OBSERVATION
  ) {
    return USER_STATUS.UNDER_OBSERVATION;
  }

  return USER_STATUS.ACTIVE;
}

function normalizeCount(value) {
  const parsedValue =
    Number(value);

  if (
    !Number.isFinite(
      parsedValue,
    )
  ) {
    return 0;
  }

  return Math.max(
    Math.trunc(
      parsedValue,
    ),
    0,
  );
}

async function getQueryCount(query) {
  const aggregateSnapshot =
    await query
      .count()
      .get();

  return normalizeCount(
    aggregateSnapshot
      .data()
      .count,
  );
}

async function getUserActivityCounts(
  userId,
) {
  if (!userId) {
    return {
      placesCount: 0,
      descriptionsCount: 0,
      photosCount: 0,
      contributionsCount: 0,
      reportsCount: 0,
    };
  }

  const [
    placesCount,
    descriptionsCount,
    photosCount,
    reportsCount,
  ] = await Promise.all([
    getQueryCount(
      db
        .collection(
          PLACE_SUBMISSIONS_COLLECTION,
        )
        .where(
          "createdBy",
          "==",
          userId,
        ),
    ),

    getQueryCount(
      db
        .collection(
          DESCRIPTION_SUBMISSIONS_COLLECTION,
        )
        .where(
          "createdBy.uid",
          "==",
          userId,
        ),
    ),

    getQueryCount(
      db
        .collection(
          PHOTO_SUBMISSIONS_COLLECTION,
        )
        .where(
          "createdBy",
          "==",
          userId,
        ),
    ),

    getQueryCount(
      db
        .collection(
          REPORTS_COLLECTION,
        )
        .where(
          "reporter.uid",
          "==",
          userId,
        ),
    ),
  ]);

  return {
    placesCount,

    descriptionsCount,

    photosCount,

    contributionsCount:
      placesCount +
      descriptionsCount +
      photosCount,

    reportsCount,
  };
}

function normalizeUser(
  document,
  activityCounts,
) {
  const data =
    document.data() ||
    {};

  const name =
    data.name ||
    "Usuario sin nombre";

  const email =
    data.email ||
    "Sin correo";

  const uid =
    data.uid ||
    document.id;

  return {
    id:
      document.id,

    uid,

    name,

    email,

    initials:
      getInitials(
        name,
        email,
      ),

    photoURL:
      data.photoURL ||
      null,

    provider:
      data.provider ||
      null,

    profile:
      data.profile ||
      data.profileLabel ||
      "Sin perfil",

    status:
      normalizeUserStatus(
        data.status,
      ),

    emailVerified:
      Boolean(
        data.emailVerified,
      ),

    createdAt:
      serializeDate(
        data.createdAt,
      ),

    updatedAt:
      serializeDate(
        data.updatedAt,
      ),

    lastLoginAt:
      serializeDate(
        data.lastLoginAt,
      ),

    activity: {
      contributionsCount:
        activityCounts
          .contributionsCount,

      reportsCount:
        activityCounts
          .reportsCount,

      /*
       * Conservamos el desglose por si después
       * quieres utilizarlo en otra vista.
       */
      placesCount:
        activityCounts
          .placesCount,

      descriptionsCount:
        activityCounts
          .descriptionsCount,

      photosCount:
        activityCounts
          .photosCount,
    },
  };
}

export default async function getAdminUsersService({
  limit = 15,
  cursor = null,
  status = USER_STATUS.ALL,
}) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 15,
        1,
      ),
      30,
    );

  const safeStatus =
    ALLOWED_STATUS_FILTERS.has(
      status,
    )
      ? status
      : USER_STATUS.ALL;

  let query =
    db
      .collection(
        USERS_COLLECTION,
      )
      .orderBy(
        "createdAt",
        "desc",
      );

  if (
    safeStatus ===
    USER_STATUS.BLOCKED
  ) {
    query =
      query.where(
        "status",
        "==",
        DATABASE_USER_STATUS.BANNED,
      );
  } else if (
    safeStatus !==
    USER_STATUS.ALL
  ) {
    query =
      query.where(
        "status",
        "==",
        safeStatus,
      );
  }

  if (cursor) {
    const cursorDocument =
      await db
        .collection(
          USERS_COLLECTION,
        )
        .doc(
          cursor,
        )
        .get();

    if (
      cursorDocument.exists
    ) {
      query =
        query.startAfter(
          cursorDocument,
        );
    }
  }

  query =
    query.limit(
      safeLimit + 1,
    );

  const snapshot =
    await query.get();

  const documents =
    snapshot.docs.slice(
      0,
      safeLimit,
    );

  const extraDocument =
    snapshot.docs[
      safeLimit
    ];

  /*
   * Obtenemos los conteos de todos los usuarios
   * de la página al mismo tiempo.
   */
  const activityResults =
    await Promise.all(
      documents.map(
        (document) => {
          const data =
            document.data() ||
            {};

          const userId =
            data.uid ||
            document.id;

          return getUserActivityCounts(
            userId,
          );
        },
      ),
    );

  const users =
    documents.map(
      (
        document,
        index,
      ) =>
        normalizeUser(
          document,
          activityResults[
            index
          ],
        ),
    );

  return {
    users,

    count:
      users.length,

    status:
      safeStatus,

    hasMore:
      Boolean(
        extraDocument,
      ),

    nextCursor:
      extraDocument
        ? documents[
            documents.length - 1
          ]?.id || null
        : null,

    limit:
      safeLimit,
  };
}