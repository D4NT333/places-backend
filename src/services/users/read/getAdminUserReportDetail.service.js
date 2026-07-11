import { db } from "../../../config/firebase.js";

const REPORT_STATUS_LABELS = {
  pending: "Pendiente",
  resolved: "Resuelto",
  discarded: "Descartado",
};

const PRIORITY_LABELS = {
  low: "Baja",
  normal: "Normal",
  medium: "Media",
  high: "Alta",
};

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function serializeDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function normalizeStatus(status) {
  return REPORT_STATUS_LABELS[status]
    ? status
    : "pending";
}

function normalizeReporter(reporter) {
  if (!reporter) {
    return {
      uid: null,
      name: "Usuario desconocido",
      email: "Sin correo",
      photoURL: null,
    };
  }

  return {
    uid: reporter.uid || null,
    name: reporter.name || "Usuario desconocido",
    email: reporter.email || "Sin correo",
    photoURL: reporter.photoURL || null,
  };
}

function normalizeReportedUser(reportedUser) {
  if (!reportedUser) {
    return {
      uid: null,
      name: "Usuario desconocido",
      photoURL: null,
    };
  }

  return {
    uid: reportedUser.uid || null,
    name: reportedUser.name || "Usuario desconocido",
    photoURL: reportedUser.photoURL || null,
  };
}

function normalizePlace(place) {
  if (!place) {
    return null;
  }

  return {
    placeId: place.placeId || null,
    placeName: place.placeName || "Lugar sin nombre",
  };
}

function normalizeReview(review) {
  if (!review) {
    return null;
  }

  return {
    reviewId: review.reviewId || null,
    rating:
      typeof review.rating === "number"
        ? review.rating
        : null,
    source: review.source || null,
  };
}

function normalizeAdmin(admin) {
  return {
    assignedTo: admin?.assignedTo || null,
    resolutionNote: admin?.resolutionNote || "",
    resolvedAt: serializeDate(admin?.resolvedAt),
    resolvedBy: admin?.resolvedBy || null,
  };
}

export default async function getAdminUserReportDetailService({
  userId,
  reportId,
}) {
  if (!userId) {
    throw createServiceError(
      "El identificador del usuario es obligatorio.",
      400
    );
  }

  if (!reportId) {
    throw createServiceError(
      "El identificador del reporte es obligatorio.",
      400
    );
  }

  const reportSnapshot = await db
    .collection("reports")
    .doc(reportId)
    .get();

  if (!reportSnapshot.exists) {
    throw createServiceError(
      "El reporte solicitado no existe.",
      404
    );
  }

  const data = reportSnapshot.data();

  const reportTarget =
    data.reportTarget ||
    data.target ||
    null;

  if (reportTarget !== "user") {
    throw createServiceError(
      "El reporte solicitado no corresponde a un usuario.",
      400
    );
  }

  const reportedUserId =
    data.reportedUser?.uid ||
    data.reportedUserId ||
    null;

  if (reportedUserId !== userId) {
    throw createServiceError(
      "El reporte no pertenece al usuario solicitado.",
      403
    );
  }

  const status = normalizeStatus(data.status);
  const priority = data.priority || "normal";

  return {
    report: {
      id: reportSnapshot.id,
      reportId:
        data.reportId ||
        reportSnapshot.id,

      reportTarget,

      reasonId:
        data.reasonId ||
        null,

      reason:
        data.reasonLabel ||
        data.reason ||
        "Reporte recibido",

      message:
        data.message ||
        "Sin explicación proporcionada.",

      priority,

      priorityLabel:
        PRIORITY_LABELS[priority] ||
        priority,

      status,

      statusLabel:
        REPORT_STATUS_LABELS[status] ||
        "Pendiente",

      source:
        data.source ||
        data.review?.source ||
        null,

      reporter:
        normalizeReporter(data.reporter),

      reportedUser:
        normalizeReportedUser(
          data.reportedUser
        ),

      place:
        normalizePlace(data.place),

      review:
        normalizeReview(data.review),

      metadata: {
        app:
          data.metadata?.app ||
          null,

        createdFrom:
          data.metadata?.createdFrom ||
          null,
      },

      admin:
        normalizeAdmin(data.admin),

      createdAt:
        serializeDate(data.createdAt),

      updatedAt:
        serializeDate(data.updatedAt),

      deletedAt:
        serializeDate(data.deletedAt),
    },
  };
}