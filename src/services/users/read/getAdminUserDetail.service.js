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

const SUBMISSION_COLLECTIONS = [
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

function getInitials(name = "", email = "") {
  const cleanName = name?.trim();

  if (cleanName) {
    const words = cleanName.split(" ").filter(Boolean);

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  const cleanEmail = email?.trim();

  if (cleanEmail) {
    return cleanEmail.replace(/@.*/, "").slice(0, 2).toUpperCase();
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

  const name = data.name || "Usuario sin nombre";
  const email = data.email || "Sin correo";
  const status = normalizeUserStatus(data.status);

  return {
    id: doc.id,
    uid: data.uid || doc.id,

    name,
    email,
    initials: getInitials(name, email),

    photoURL: data.photoURL || null,

    provider: data.provider || null,
    providerLabel:
      data.provider === "google.com"
        ? "Google"
        : data.provider || "Sin proveedor",

    profile: data.profile || data.profileLabel || "Sin perfil",

    status,
    statusLabel: getUserStatusLabel(status),

    birthday: data.birthday || data.birthDate || null,
    emailVerified: Boolean(data.emailVerified),

    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    lastLoginAt: serializeDate(data.lastLoginAt),
  };
}

function normalizeSubmissionForStats(doc, type) {
  const data = doc.data();

  const createdAt = data.createdAt || data.submittedAt || data.updatedAt;

  return {
    id: doc.id,
    type,
    status: normalizeSubmissionStatus(data.status),
    createdAtDate: toDate(createdAt),
  };
}

async function getSubmissionsForStats({
  collectionName,
  userField,
  userId,
  type,
  limit = 200,
}) {
  const snapshot = await db
    .collection(collectionName)
    .where(userField, "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) =>
    normalizeSubmissionForStats(doc, type)
  );
}

function buildWeeklyActivity(submissions) {
  const countsByDay = {
    Dom: 0,
    Lun: 0,
    Mar: 0,
    Mié: 0,
    Jue: 0,
    Vie: 0,
    Sáb: 0,
  };

  submissions.forEach((submission) => {
    if (!submission.createdAtDate) return;

    const dayLabel = WEEK_DAYS[submission.createdAtDate.getDay()];

    countsByDay[dayLabel] += 1;
  });

  return [
    {
      label: "Lun",
      value: countsByDay.Lun,
    },
    {
      label: "Mar",
      value: countsByDay.Mar,
    },
    {
      label: "Mié",
      value: countsByDay.Mié,
    },
    {
      label: "Jue",
      value: countsByDay.Jue,
    },
    {
      label: "Vie",
      value: countsByDay.Vie,
    },
    {
      label: "Sáb",
      value: countsByDay.Sáb,
    },
    {
      label: "Dom",
      value: countsByDay.Dom,
    },
  ];
}

function countByStatus(submissions, statuses) {
  return submissions.filter((submission) =>
    statuses.includes(submission.status)
  ).length;
}

export default async function getAdminUserDetailService({ userId }) {
  const userDoc = await db.collection("user").doc(userId).get();

  if (!userDoc.exists) {
    const error = new Error("El usuario no existe.");
    error.statusCode = 404;
    throw error;
  }

  const user = normalizeUser(userDoc);

  const [
    placeSubmissions,
    descriptionSubmissions,
    photoSubmissions,
  ] = await Promise.all(
    SUBMISSION_COLLECTIONS.map((config) =>
      getSubmissionsForStats({
        collectionName: config.collectionName,
        userField: config.userField,
        userId,
        type: config.type,
        limit: 200,
      })
    )
  );

  const allSubmissions = [
    ...placeSubmissions,
    ...descriptionSubmissions,
    ...photoSubmissions,
  ];

  const totalContributions = allSubmissions.length;

  const approvedCount = countByStatus(allSubmissions, [
    "approved",
  ]);

  const rejectedCount = countByStatus(allSubmissions, [
    "rejected",
  ]);

  const pendingCount = countByStatus(allSubmissions, [
    "in_review",
    "pending",
    "returned",
    "resubmitted",
  ]);

  const weeklyActivity = buildWeeklyActivity(allSubmissions);

  return {
    user,

    moderation: {
      reportsCount: 0,
      emptyMessage: "Este usuario no tiene reportes recibidos.",
    },

    activity: {
      totalContributions,

      placesCount: placeSubmissions.length,
      descriptionsCount: descriptionSubmissions.length,
      photosCount: photoSubmissions.length,
      reportsSentCount: 0,

      approvedCount,
      rejectedCount,
      pendingCount,

      weeklyActivity,
    },
  };
}