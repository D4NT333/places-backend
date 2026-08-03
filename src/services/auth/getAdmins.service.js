import {
  auth,
  db,
} from "../../config/firebase.js";

const ADMIN_USERS_COLLECTION =
  "adminUsers";

const VALID_FILTERS = [
  "all",
  "active",
  "disabled",
  "admin",
  "super_admin",
];

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
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

function normalizeTimestamp(
  value,
) {
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

  if (
    typeof value ===
    "string"
  ) {
    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime(),
    )
      ? null
      : date.toISOString();
  }

  return null;
}

function normalizeRole(role) {
  return role ===
    "super_admin"
    ? "super_admin"
    : "admin";
}

function normalizeRoleLabel(role) {
  return role ===
    "super_admin"
    ? "Superadministrador"
    : "Administrador";
}

function normalizeStatus(
  isActive,
) {
  return isActive === true
    ? "active"
    : "disabled";
}

function normalizeStatusLabel(
  status,
) {
  return status ===
    "active"
    ? "Activo"
    : "Desactivado";
}

function getInitials(
  displayName,
  email,
) {
  const cleanName =
    cleanText(
      displayName,
    );

  if (cleanName) {
    const words =
      cleanName
        .split(/\s+/)
        .filter(Boolean);

    if (
      words.length >= 2
    ) {
      return `${words[0][0]}${
        words[1][0]
      }`.toUpperCase();
    }

    return cleanName
      .slice(
        0,
        2,
      )
      .toUpperCase();
  }

  const cleanEmail =
    cleanText(
      email,
    );

  if (cleanEmail) {
    return cleanEmail
      .slice(
        0,
        2,
      )
      .toUpperCase();
  }

  return "AD";
}

function parseLimit(limit) {
  const parsedLimit =
    Number(limit);

  if (
    !Number.isInteger(
      parsedLimit,
    ) ||
    parsedLimit <= 0
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    parsedLimit,
    MAX_LIMIT,
  );
}

function passesFilter(
  admin,
  filter,
) {
  if (
    filter === "all"
  ) {
    return true;
  }

  if (
    filter === "active"
  ) {
    return (
      admin.status ===
      "active"
    );
  }

  if (
    filter === "disabled"
  ) {
    return (
      admin.status ===
      "disabled"
    );
  }

  if (
    filter === "admin"
  ) {
    return (
      admin.role ===
      "admin"
    );
  }

  if (
    filter ===
    "super_admin"
  ) {
    return (
      admin.role ===
      "super_admin"
    );
  }

  return true;
}

async function getAuthenticationUsers(
  uids,
) {
  if (!uids.length) {
    return new Map();
  }

  const result =
    await auth.getUsers(
      uids.map(
        (uid) => ({
          uid,
        }),
      ),
    );

  const usersMap =
    new Map();

  result.users.forEach(
    (userRecord) => {
      usersMap.set(
        userRecord.uid,
        userRecord,
      );
    },
  );

  return usersMap;
}

function buildSummary(admins) {
  return {
    total:
      admins.length,

    active:
      admins.filter(
        (admin) =>
          admin.status ===
          "active",
      ).length,

    disabled:
      admins.filter(
        (admin) =>
          admin.status ===
          "disabled",
      ).length,

    admins:
      admins.filter(
        (admin) =>
          admin.role ===
          "admin",
      ).length,

    superAdmins:
      admins.filter(
        (admin) =>
          admin.role ===
          "super_admin",
      ).length,

    activeSuperAdmins:
      admins.filter(
        (admin) =>
          admin.role ===
            "super_admin" &&
          admin.status ===
            "active",
      ).length,
  };
}

export default async function getAdminsService({
  requesterUid,
  filter = "all",
  limit = DEFAULT_LIMIT,
  cursor = null,
}) {
  const requestedFilter =
    cleanText(
      filter,
    ) ||
    "all";

  if (
    !VALID_FILTERS.includes(
      requestedFilter,
    )
  ) {
    const error =
      new Error(
        "Filtro de administradores inválido.",
      );

    error.statusCode =
      400;

    throw error;
  }

  const finalLimit =
    parseLimit(
      limit,
    );

  const snapshot =
    await db
      .collection(
        ADMIN_USERS_COLLECTION,
      )
      .get();

  const databaseAdmins =
    snapshot.docs.map(
      (document) => {
        const data =
          document.data() ||
          {};

        return {
          id:
            document.id,

          uid:
            cleanText(
              data.uid,
            ) ||
            document.id,

          displayName:
            cleanText(
              data.displayName,
            ),

          email:
            cleanText(
              data.email,
            ),

          role:
            normalizeRole(
              data.role,
            ),

          isActive:
            data.isActive ===
            true,

          permissions:
            data.permissions ||
            {},

          createdAt:
            normalizeTimestamp(
              data.createdAt,
            ),

          createdByUid:
            cleanText(
              data.createdBy,
            ),

          updatedAt:
            normalizeTimestamp(
              data.updatedAt,
            ),

          /*
           * Propuestas móviles de lugares
           * aprobadas por el administrador.
           */
          approvedPlaceSubmissionsCount:
            normalizeCount(
              data
                .approvedPlaceSubmissionsCount,
            ),

          /*
           * Reportes de usuarios y lugares
           * procesados por el administrador.
           */
          resolvedReportsCount:
            normalizeCount(
              data
                .resolvedReportsCount,
            ),

          /*
           * Candidatos de Google aceptados
           * y registrados como lugares.
           */
          acceptedPlacesCount:
            normalizeCount(
              data
                .acceptedPlacesCount,
            ),
        };
      },
    );

  const authenticationUsers =
    await getAuthenticationUsers(
      databaseAdmins.map(
        (admin) =>
          admin.uid,
      ),
    );

  /*
   * Usamos los mismos documentos ya descargados
   * para resolver createdBy sin hacer una consulta
   * adicional por cada administrador.
   */
  const adminNameByUid =
    new Map(
      databaseAdmins.map(
        (admin) => [
          admin.uid,

          admin.displayName ||
            admin.email ||
            "Administrador",
        ],
      ),
    );

  const normalizedAdmins =
    databaseAdmins.map(
      (admin) => {
        const authUser =
          authenticationUsers.get(
            admin.uid,
          );

        const displayName =
          admin.displayName ||
          cleanText(
            authUser
              ?.displayName,
          ) ||
          "Administrador";

        const email =
          admin.email ||
          cleanText(
            authUser
              ?.email,
          );

        const status =
          normalizeStatus(
            admin.isActive,
          );

        const createdBy =
          admin.createdByUid
            ? adminNameByUid.get(
                admin
                  .createdByUid,
              ) ||
              "Administrador"
            : "Sistema";

        /*
         * Firebase Authentication nos proporciona
         * el último inicio de sesión.
         *
         * Por ahora se utiliza como última acción
         * disponible en el modal.
         */
        const lastActivityAt =
          normalizeTimestamp(
            authUser
              ?.metadata
              ?.lastSignInTime,
          );

        return {
          id:
            admin.id,

          uid:
            admin.uid,

          displayName,

          email,

          photoURL:
            cleanText(
              authUser
                ?.photoURL,
            ) ||
            null,

          initials:
            getInitials(
              displayName,
              email,
            ),

          role:
            admin.role,

          roleLabel:
            normalizeRoleLabel(
              admin.role,
            ),

          status,

          statusLabel:
            normalizeStatusLabel(
              status,
            ),

          isActive:
            admin.isActive,

          isCurrentAdmin:
            admin.uid ===
            requesterUid,

          permissions:
            admin.permissions,

          createdAt:
            admin.createdAt,

          createdBy,

          createdByUid:
            admin.createdByUid ||
            null,

          updatedAt:
            admin.updatedAt,

          lastActivityAt,

          activity: {
            /*
             * Propuestas de lugares aprobadas.
             */
            approvedPlaces:
              admin
                .approvedPlaceSubmissionsCount,

            /*
             * Total conjunto de reportes
             * de usuarios y lugares procesados.
             */
            resolvedReports:
              admin
                .resolvedReportsCount,

            /*
             * Candidatos de Google aceptados.
             */
            loadedCandidates:
              admin
                .acceptedPlacesCount,

            lastAction:
              lastActivityAt,
          },
        };
      },
    );

  /*
   * Primero calculamos el resumen con toda
   * la colección para que las tarjetas no
   * cambien al seleccionar filtros.
   */
  const summary =
    buildSummary(
      normalizedAdmins,
    );

  const filteredAdmins =
    normalizedAdmins
      .filter(
        (admin) =>
          passesFilter(
            admin,
            requestedFilter,
          ),
      )
      .sort(
        (
          first,
          second,
        ) => {
          const firstTime =
            first.createdAt
              ? new Date(
                  first.createdAt,
                ).getTime()
              : 0;

          const secondTime =
            second.createdAt
              ? new Date(
                  second.createdAt,
                ).getTime()
              : 0;

          if (
            firstTime !==
            secondTime
          ) {
            return (
              firstTime -
              secondTime
            );
          }

          return first.uid
            .localeCompare(
              second.uid,
            );
        },
      );

  let startIndex =
    0;

  if (cursor) {
    const cursorIndex =
      filteredAdmins
        .findIndex(
          (admin) =>
            admin.uid ===
            cursor,
        );

    if (
      cursorIndex >= 0
    ) {
      startIndex =
        cursorIndex +
        1;
    }
  }

  const pageItems =
    filteredAdmins.slice(
      startIndex,
      startIndex +
        finalLimit +
        1,
    );

  const hasMore =
    pageItems.length >
    finalLimit;

  const items =
    hasMore
      ? pageItems.slice(
          0,
          finalLimit,
        )
      : pageItems;

  const lastItem =
    items[
      items.length - 1
    ];

  return {
    items,

    summary,

    pagination: {
      limit:
        finalLimit,

      hasMore,

      nextCursor:
        hasMore &&
        lastItem
          ? lastItem.uid
          : null,
    },
  };
}