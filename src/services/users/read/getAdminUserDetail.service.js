import { db } from "../../../config/firebase.js";

const USER_STATUS_LABELS = {
  active: "Activo",
  under_observation: "En revisión",
  warned: "Advertido",
  blocked: "Bloqueado",
};

const SUBMISSION_STATUS_LABELS = {
  in_review: "Pendiente",
  pending: "Pendiente",
  returned: "Devuelto",
  resubmitted: "Reenviado",
  approved: "Aprobado",
  rejected: "Rechazado",
  pending_delete: "Eliminación solicitada",
};

const WEEK_DAYS = [
  "Dom",
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
];

const ACTIVITY_COLLECTIONS = [
  {
    type: "place",
    collectionName: "placeSubmissions",
    userField: "createdBy",
  },
  {
    type: "description",
    collectionName: "descriptionSubmissions",
    userField: "createdBy.uid",
  },
  {
    type: "photo",
    collectionName: "photoSubmissions",
    userField: "createdBy",
  },
  {
    type: "report",
    collectionName: "reports",
    userField: "reporter.uid",
  },
];

function serializeDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function toDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDateOnly(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMondayFromDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  const currentDay = date.getDay();

  const daysSinceMonday =
    currentDay === 0
      ? 6
      : currentDay - 1;

  date.setDate(
    date.getDate() - daysSinceMonday
  );

  return date;
}

function getCurrentWeekStart() {
  return getMondayFromDate(new Date());
}

function normalizeSelectedWeekStart(value) {
  if (!value) {
    return getCurrentWeekStart();
  }

  const parsedDate = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return getCurrentWeekStart();
  }

  return getMondayFromDate(parsedDate);
}

function getWeekRange(weekStartValue) {
  const start =
    normalizeSelectedWeekStart(weekStartValue);

  const endExclusive = new Date(start);

  endExclusive.setDate(
    endExclusive.getDate() + 7
  );

  const endInclusive = new Date(start);

  endInclusive.setDate(
    endInclusive.getDate() + 6
  );

  endInclusive.setHours(
    23,
    59,
    59,
    999
  );

  return {
    start,
    endExclusive,
    endInclusive,
  };
}

function isDateInsideWeek(
  date,
  start,
  endExclusive
) {
  if (!date) return false;

  return (
    date >= start &&
    date < endExclusive
  );
}

function getInitials(name = "", email = "") {
  const cleanName = name?.trim();

  if (cleanName) {
    const words = cleanName
      .split(" ")
      .filter(Boolean);

    if (words.length === 1) {
      return words[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`
      .toUpperCase();
  }

  const cleanEmail = email?.trim();

  if (cleanEmail) {
    return cleanEmail
      .replace(/@.*/, "")
      .slice(0, 2)
      .toUpperCase();
  }

  return "US";
}

function normalizeUserStatus(status) {
  if (USER_STATUS_LABELS[status]) {
    return status;
  }

  return "active";
}

function normalizeSubmissionStatus(status) {
  if (SUBMISSION_STATUS_LABELS[status]) {
    return status;
  }

  return "in_review";
}

function getUserStatusLabel(status) {
  return USER_STATUS_LABELS[status] || "Activo";
}

function normalizeUser(doc) {
  const data = doc.data();

  const name =
    data.name ||
    "Usuario sin nombre";

  const email =
    data.email ||
    "Sin correo";

  const status =
    normalizeUserStatus(data.status);

  return {
    id: doc.id,
    uid: data.uid || doc.id,

    name,
    email,
    initials: getInitials(name, email),

    photoURL:
      data.photoURL ||
      null,

    provider:
      data.provider ||
      null,

    providerLabel:
      data.provider === "google.com"
        ? "Google"
        : data.provider ||
          "Sin proveedor",

    profile:
      data.profile ||
      data.profileLabel ||
      "Sin perfil",

    status,
    statusLabel:
      getUserStatusLabel(status),

    birthday:
      data.birthday ||
      data.birthDate ||
      null,

    emailVerified:
      Boolean(data.emailVerified),

    createdAt:
      serializeDate(data.createdAt),

    updatedAt:
      serializeDate(data.updatedAt),

    lastLoginAt:
      serializeDate(data.lastLoginAt),
  };
}

function normalizeActivityItem(doc, type) {
  const data = doc.data();

  const createdAt =
    data.createdAt ||
    data.submittedAt ||
    data.updatedAt;

  return {
    id: doc.id,

    type,

    status:
      type === "report"
        ? data.status || "pending"
        : normalizeSubmissionStatus(
            data.status
          ),

    createdAtDate:
      toDate(createdAt),
  };
}

async function getActivityItems({
  collectionName,
  userField,
  userId,
  type,
  limit = 500,
}) {
  const snapshot = await db
    .collection(collectionName)
    .where(userField, "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) =>
    normalizeActivityItem(doc, type)
  );
}

function buildWeeklyActivity(items) {
  const days = {
    Lun: {
      label: "Lun",
      value: 0,
      places: 0,
      descriptions: 0,
      photos: 0,
      reports: 0,
    },
    Mar: {
      label: "Mar",
      value: 0,
      places: 0,
      descriptions: 0,
      photos: 0,
      reports: 0,
    },
    Mié: {
      label: "Mié",
      value: 0,
      places: 0,
      descriptions: 0,
      photos: 0,
      reports: 0,
    },
    Jue: {
      label: "Jue",
      value: 0,
      places: 0,
      descriptions: 0,
      photos: 0,
      reports: 0,
    },
    Vie: {
      label: "Vie",
      value: 0,
      places: 0,
      descriptions: 0,
      photos: 0,
      reports: 0,
    },
    Sáb: {
      label: "Sáb",
      value: 0,
      places: 0,
      descriptions: 0,
      photos: 0,
      reports: 0,
    },
    Dom: {
      label: "Dom",
      value: 0,
      places: 0,
      descriptions: 0,
      photos: 0,
      reports: 0,
    },
  };

  items.forEach((item) => {
    if (!item.createdAtDate) {
      return;
    }

    const dayLabel =
      WEEK_DAYS[
        item.createdAtDate.getDay()
      ];

    const day = days[dayLabel];

    day.value += 1;

    switch (item.type) {
      case "place":
        day.places += 1;
        break;

      case "description":
        day.descriptions += 1;
        break;

      case "photo":
        day.photos += 1;
        break;

      case "report":
        day.reports += 1;
        break;

      default:
        break;
    }
  });

  return [
    days.Lun,
    days.Mar,
    days.Mié,
    days.Jue,
    days.Vie,
    days.Sáb,
    days.Dom,
  ];
}

function countByStatus(items, statuses) {
  return items.filter((item) =>
    statuses.includes(item.status)
  ).length;
}

function buildAvailableWeeks(
  items,
  maximumWeeks = 12
) {
  const weekMap = new Map();

  const currentWeekStart =
    getCurrentWeekStart();

  weekMap.set(
    formatDateOnly(currentWeekStart),
    currentWeekStart
  );

  items.forEach((item) => {
    if (!item.createdAtDate) {
      return;
    }

    const weekStart =
      getMondayFromDate(
        item.createdAtDate
      );

    if (!weekStart) {
      return;
    }

    const key =
      formatDateOnly(weekStart);

    if (!weekMap.has(key)) {
      weekMap.set(key, weekStart);
    }
  });

  return Array.from(
    weekMap.values()
  )
    .sort(
      (a, b) =>
        b.getTime() - a.getTime()
    )
    .slice(0, maximumWeeks)
    .map((start) => {
      const end = new Date(start);

      end.setDate(
        end.getDate() + 6
      );

      return {
        start: formatDateOnly(start),
        end: formatDateOnly(end),
      };
    });
}

export default async function getAdminUserDetailService({
  userId,
  weekStart = null,
}) {
  const userDoc = await db
    .collection("user")
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    const error = new Error(
      "El usuario no existe."
    );

    error.statusCode = 404;

    throw error;
  }

  const user = normalizeUser(userDoc);

  const [
    placeItems,
    descriptionItems,
    photoItems,
    reportItems,
  ] = await Promise.all(
    ACTIVITY_COLLECTIONS.map(
      (config) =>
        getActivityItems({
          collectionName:
            config.collectionName,

          userField:
            config.userField,

          userId,

          type:
            config.type,

          limit: 500,
        })
    )
  );

  const allActivityItems = [
    ...placeItems,
    ...descriptionItems,
    ...photoItems,
    ...reportItems,
  ];

  const {
    start,
    endExclusive,
    endInclusive,
  } = getWeekRange(weekStart);

  const selectedWeekItems =
    allActivityItems.filter((item) =>
      isDateInsideWeek(
        item.createdAtDate,
        start,
        endExclusive
      )
    );

  const selectedPlaces =
    selectedWeekItems.filter(
      (item) =>
        item.type === "place"
    );

  const selectedDescriptions =
    selectedWeekItems.filter(
      (item) =>
        item.type === "description"
    );

  const selectedPhotos =
    selectedWeekItems.filter(
      (item) =>
        item.type === "photo"
    );

  const selectedReports =
    selectedWeekItems.filter(
      (item) =>
        item.type === "report"
    );

  /*
    Los reportes no usan los estados
    approved, rejected, returned, etc.

    Por eso estos tres conteos se calculan
    solamente con propuestas.
  */
  const selectedSubmissions =
    selectedWeekItems.filter(
      (item) =>
        item.type !== "report"
    );

  const approvedCount =
    countByStatus(
      selectedSubmissions,
      ["approved"]
    );

  const rejectedCount =
    countByStatus(
      selectedSubmissions,
      ["rejected"]
    );

  const pendingCount =
    countByStatus(
      selectedSubmissions,
      [
        "in_review",
        "pending",
        "returned",
        "resubmitted",
      ]
    );

  const weeklyActivity =
    buildWeeklyActivity(
      selectedWeekItems
    );

  const availableWeeks =
    buildAvailableWeeks(
      allActivityItems,
      12
    );

  return {
    user,

    moderation: {
      reportsCount: 0,

      emptyMessage:
        "Este usuario no tiene reportes recibidos.",
    },

    activity: {
      /*
        Estos valores corresponden
        a la semana seleccionada.
      */
      totalContributions:
        selectedWeekItems.length,

      placesCount:
        selectedPlaces.length,

      descriptionsCount:
        selectedDescriptions.length,

      photosCount:
        selectedPhotos.length,

      reportsSentCount:
        selectedReports.length,

      approvedCount,
      rejectedCount,
      pendingCount,

      weeklyActivity,

      selectedWeek: {
        start:
          formatDateOnly(start),

        end:
          formatDateOnly(
            endInclusive
          ),
      },

      availableWeeks,

      /*
        Los dejamos disponibles por si
        después quieres mostrar también
        los totales históricos.
      */
      historicalTotals: {
        totalContributions:
          allActivityItems.length,

        placesCount:
          placeItems.length,

        descriptionsCount:
          descriptionItems.length,

        photosCount:
          photoItems.length,

        reportsSentCount:
          reportItems.length,
      },
    },
  };
}