import admin from "firebase-admin";

const db = admin.firestore();

const VALID_STATUS_FILTERS = [
  "all",
  "pending",
  "in_review",
  "resolved",
  "dismissed",
];

const STATUS_LABELS = {
  pending: "Pendiente",
  in_review: "En revisión",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

const TARGET_LABELS = {
  general: "General",
  place: "Lugar",
  user: "Usuario",
};

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toISOString(value) {
  if (!value) return null;

  if (value?.toDate) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

async function assertAdminUser(uid) {
  const adminSnap = await db.collection("adminUsers").doc(uid).get();

  if (!adminSnap.exists) {
    const error = new Error("No tienes permisos para consultar reportes.");
    error.statusCode = 403;
    throw error;
  }

  const adminData = adminSnap.data();

  if (adminData.disabled === true || adminData.active === false) {
    const error = new Error("Tu usuario administrador no está activo.");
    error.statusCode = 403;
    throw error;
  }

  return adminData;
}

function getRelatedTo(report = {}) {
  if (report.reportTarget === "general") {
    return {
      type: "general",
      label: "Sistema general",
      id: null,
    };
  }

  if (report.reportTarget === "place") {
    return {
      type: "place",
      label: report.place?.placeName || "Lugar reportado",
      id: report.place?.placeId || null,
    };
  }

  if (report.reportTarget === "user") {
    if (report.source === "review") {
      return {
        type: "review",
        label: report.reportedUser?.name
          ? `Reseña de ${report.reportedUser.name}`
          : "Reseña reportada",
        id: report.review?.reviewId || null,
      };
    }

    return {
      type: "user",
      label: report.reportedUser?.name || "Usuario reportado",
      id: report.reportedUser?.uid || null,
    };
  }

  return {
    type: "unknown",
    label: "Sin relación",
    id: null,
  };
}

function normalizeReport(doc) {
  const data = doc.data();
  const relatedTo = getRelatedTo(data);

  const reporterName = data.reporter?.name || "Usuario";

  return {
    id: doc.id,
    reportId: data.reportId || doc.id,

    type: data.reportTarget || "general",
    typeLabel: TARGET_LABELS[data.reportTarget] || "General",

    reasonId: data.reasonId || "",
    reasonLabel: data.reasonLabel || "Motivo no especificado",

    relatedTo,

    status: data.status || "pending",
    statusLabel: STATUS_LABELS[data.status] || "Pendiente",

    priority: data.priority || "normal",
    source: data.source || "manual",

    reporter: {
      uid: data.reporter?.uid || "",
      name: reporterName,
      email: data.reporter?.email || "",
      photoURL: data.reporter?.photoURL || "",
      initial: reporterName.charAt(0).toUpperCase(),
    },

    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt),
  };
}

export default async function getReportsService({ user, query }) {
  if (!user?.uid) {
    const error = new Error("Debes iniciar sesión.");
    error.statusCode = 401;
    throw error;
  }

  await assertAdminUser(user.uid);

  const rawStatus = cleanString(query.status) || "all";

  const status = VALID_STATUS_FILTERS.includes(rawStatus)
    ? rawStatus
    : "all";

  const rawLimit = Number(query.limit || 15);

  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 30)
    : 15;

  const cursor = cleanString(query.cursor);

  let reportsQuery = db.collection("reports");

  if (status !== "all") {
    reportsQuery = reportsQuery.where("status", "==", status);
  }

  reportsQuery = reportsQuery
    .orderBy("createdAt", "desc")
    .limit(limit + 1);

  if (cursor) {
    const cursorSnap = await db.collection("reports").doc(cursor).get();

    if (cursorSnap.exists) {
      reportsQuery = reportsQuery.startAfter(cursorSnap);
    }
  }

  const snapshot = await reportsQuery.get();

  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const visibleDocs = hasMore ? docs.slice(0, limit) : docs;

  const reports = visibleDocs.map(normalizeReport);

  const nextCursor =
    hasMore && visibleDocs.length > 0
      ? visibleDocs[visibleDocs.length - 1].id
      : null;

  return {
    reports,
    pagination: {
      limit,
      count: reports.length,
      hasMore,
      nextCursor,
    },
    filters: {
      status,
    },
  };
}