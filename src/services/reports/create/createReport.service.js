import admin from "firebase-admin";

const db = admin.firestore();

const VALID_TARGETS = ["general", "place", "user"];

const REPORT_REASONS = {
  general: {
    error: "Error",
    performance: "Rendimiento",
    visual_problem: "Problema visual",
  },
  place: {
    wrong_info: "Información incorrecta",
    wrong_location: "Ubicación incorrecta",
    wrong_photos: "Fotos incorrectas",
  },
  user: {
    spam: "Spam",
    offensive_content: "Contenido ofensivo",
    suspicious_activity: "Actividad sospechosa",
  },
};

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getReasonLabel(reportTarget, reasonId) {
  return REPORT_REASONS?.[reportTarget]?.[reasonId] || "Motivo no especificado";
}

function getInitialPriority({ reportTarget, reasonId, source }) {
  if (reportTarget === "user" && reasonId === "offensive_content") {
    return "high";
  }

  if (reportTarget === "user" && reasonId === "suspicious_activity") {
    return "high";
  }

  if (reportTarget === "place" && reasonId === "wrong_location") {
    return "normal";
  }

  if (source === "review") {
    return "normal";
  }

  return "normal";
}

export default async function createReportService({ user, payload }) {
  if (!user?.uid) {
    const error = new Error("Debes iniciar sesión para crear un reporte.");
    error.statusCode = 401;
    throw error;
  }

  const reportTarget = cleanString(payload.reportTarget);
  const reasonId = cleanString(payload.reasonId);
  const message = cleanString(payload.message);
  const source = cleanString(payload.source) || "manual";

  if (!VALID_TARGETS.includes(reportTarget)) {
    const error = new Error("El tipo de reporte no es válido.");
    error.statusCode = 400;
    throw error;
  }

  if (!reasonId || !REPORT_REASONS?.[reportTarget]?.[reasonId]) {
    const error = new Error("El motivo del reporte no es válido.");
    error.statusCode = 400;
    throw error;
  }

  if (message.length < 20) {
    const error = new Error("El reporte debe tener al menos 20 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (message.length > 500) {
    const error = new Error("El reporte no puede superar los 500 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  const reportRef = db.collection("reports").doc();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const reasonLabel = getReasonLabel(reportTarget, reasonId);

  const placeId = cleanString(payload.placeId);
  const placeName = cleanString(payload.placeName);

  const reportedUserId = cleanString(payload.reportedUserId);
  const reportedUserName = cleanString(payload.reportedUserName);

  const reviewId = cleanString(payload.reviewId);

  const reportData = {
    reportId: reportRef.id,

    reportTarget,
    reasonId,
    reasonLabel,
    message,

    source,

    status: "pending",
    priority: getInitialPriority({
      reportTarget,
      reasonId,
      source,
    }),

    reporter: {
      uid: user.uid,
      name: user.name || user.displayName || "Usuario",
      email: user.email || "",
      photoURL: user.picture || user.photoURL || "",
    },

    place: {
      placeId: placeId || null,
      placeName: placeName || null,
    },

    reportedUser: {
      uid: reportedUserId || null,
      name: reportedUserName || null,
    },

    review: {
      reviewId: reviewId || null,
      rating:
        typeof payload.rating === "number"
          ? payload.rating
          : Number(payload.rating || 0),
    },

    admin: {
      assignedTo: null,
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: "",
    },

    metadata: {
      app: "mobile",
      createdFrom: "ReportProblemScreen",
    },

    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await reportRef.set(reportData);

  return {
    id: reportRef.id,
    reportId: reportRef.id,
    status: "pending",
    message: "Reporte creado correctamente.",
  };
}