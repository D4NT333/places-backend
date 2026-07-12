import { db } from "../../../config/firebase.js";

const SUBMISSION_STATUS_LABELS = {
  in_review: "Pendiente",
  pending: "Pendiente",
  returned: "Devuelto",
  resubmitted: "Reenviado",
  approved: "Aprobado",
  rejected: "Rechazado",
  pending_delete: "Eliminación solicitada",
};

const REPORT_STATUS_LABELS = {
  pending: "Pendiente",
  resolved: "Resuelto",
  discarded: "Descartado",
};

const HISTORY_TYPE_LABELS = {
  place: "Lugar",
  description: "Descripción",
  photo: "Fotografías",
  report: "Reporte",
};

const COLLECTION_CONFIG = {
  place: {
    collectionName: "placeSubmissions",
    userField: "createdBy",
  },

  description: {
    collectionName: "descriptionSubmissions",
    userField: "createdBy.uid",
  },

  photo: {
    collectionName: "photoSubmissions",
    userField: "createdBy",
  },

  report: {
    collectionName: "reports",
    userField: "reporter.uid",
  },
};

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

function normalizeSubmissionStatus(status) {
  return SUBMISSION_STATUS_LABELS[status]
    ? status
    : "in_review";
}

function normalizeReportStatus(status) {
  return REPORT_STATUS_LABELS[status]
    ? status
    : "pending";
}

function getSubmissionStatusLabel(status) {
  return SUBMISSION_STATUS_LABELS[status] || "Pendiente";
}

function getReportStatusLabel(status) {
  return REPORT_STATUS_LABELS[status] || "Pendiente";
}

function getRelatedLabel(type, placeName) {
  const safePlaceName = placeName || "Sin lugar";

  switch (type) {
    case "place":
      return safePlaceName;

    case "description":
      return `Descripción para ${safePlaceName}`;

    case "photo":
      return `Fotografías para ${safePlaceName}`;

    default:
      return safePlaceName;
  }
}

function getReportRelatedLabel(data) {
  const reportTarget = data.reportTarget;

  if (reportTarget === "user") {
    const reportedUserName =
      data.reportedUser?.name ||
      "Usuario sin nombre";

    return `Reporte sobre ${reportedUserName}`;
  }

  if (reportTarget === "place") {
    const placeName =
      data.place?.placeName ||
      "Lugar sin nombre";

    return `Reporte sobre ${placeName}`;
  }

  if (reportTarget === "general") {
    return data.reasonLabel || "Reporte general";
  }

  if (data.place?.placeName) {
    return `Reporte sobre ${data.place.placeName}`;
  }

  if (data.reportedUser?.name) {
    return `Reporte sobre ${data.reportedUser.name}`;
  }

  return data.reasonLabel || "Reporte general";
}

function normalizeHistoryDoc(doc, type) {
  const data = doc.data();

  const status = normalizeSubmissionStatus(data.status);

  const createdAt =
    data.createdAt ||
    data.submittedAt ||
    data.updatedAt;

  const placeName =
    data.placeName ||
    data.name ||
    "Sin lugar";

  return {
    id: doc.id,

    submissionId:
      data.submissionId ||
      doc.id,

    type,

    typeLabel:
      HISTORY_TYPE_LABELS[type] ||
      "Propuesta",

    relatedLabel:
      getRelatedLabel(type, placeName),

    status,

    statusLabel:
      getSubmissionStatusLabel(status),

    placeId:
      data.placeId ||
      data.placeDocId ||
      null,

    placeName,

    createdAt:
      serializeDate(createdAt),

    createdAtMs:
      toDate(createdAt)?.getTime?.() || 0,

    updatedAt:
      serializeDate(data.updatedAt),

    rawCollection:
      COLLECTION_CONFIG[type].collectionName,
  };
}

function normalizeReportDoc(doc) {
  const data = doc.data();

  const status = normalizeReportStatus(data.status);

  const createdAt =
    data.createdAt ||
    data.updatedAt;

  return {
    id: doc.id,

    submissionId:
      data.reportId ||
      doc.id,

    type: "report",

    typeLabel:
      HISTORY_TYPE_LABELS.report,

    relatedLabel:
      getReportRelatedLabel(data),

    status,

    statusLabel:
      getReportStatusLabel(status),

    reportId:
      data.reportId ||
      doc.id,

    reportTarget:
      data.reportTarget ||
      null,

    reasonId:
      data.reasonId ||
      null,

    reasonLabel:
      data.reasonLabel ||
      "Sin motivo",

    message:
      data.message ||
      "",

    placeId:
      data.place?.placeId ||
      null,

    placeName:
      data.place?.placeName ||
      null,

    reportedUserId:
      data.reportedUser?.uid ||
      null,

    reportedUserName:
      data.reportedUser?.name ||
      null,

    reporterId:
      data.reporter?.uid ||
      null,

    reporterName:
      data.reporter?.name ||
      null,

    createdAt:
      serializeDate(createdAt),

    createdAtMs:
      toDate(createdAt)?.getTime?.() || 0,

    updatedAt:
      serializeDate(data.updatedAt),

    rawCollection:
      COLLECTION_CONFIG.report.collectionName,
  };
}

function encodeCursor(value) {
  return Buffer.from(
    JSON.stringify(value)
  ).toString("base64");
}

function decodeCursor(cursor) {
  if (!cursor) return null;

  try {
    return JSON.parse(
      Buffer.from(cursor, "base64").toString("utf8")
    );
  } catch {
    return null;
  }
}

async function getCollectionItems({
  type,
  userId,
  cursorDocId = null,
  limit,
}) {
  const config = COLLECTION_CONFIG[type];

  let query = db
    .collection(config.collectionName)
    .where(config.userField, "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (cursorDocId) {
    const cursorDoc = await db
      .collection(config.collectionName)
      .doc(cursorDocId)
      .get();

    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => {
    if (type === "report") {
      return normalizeReportDoc(doc);
    }

    return normalizeHistoryDoc(doc, type);
  });
}

export default async function getAdminUserHistoryService({
  userId,
  limit = 15,
  cursor = null,
}) {
  const safeLimit = Math.min(
    Number(limit) || 15,
    30
  );

  const decodedCursor =
    decodeCursor(cursor) || {};

  const placeCursor =
    decodedCursor.place || null;

  const descriptionCursor =
    decodedCursor.description || null;

  const photoCursor =
    decodedCursor.photo || null;

  const reportCursor =
    decodedCursor.report || null;

  const requestLimitPerCollection =
    safeLimit + 1;

  const [
    placeItems,
    descriptionItems,
    photoItems,
    reportItems,
  ] = await Promise.all([
    getCollectionItems({
      type: "place",
      userId,
      cursorDocId: placeCursor,
      limit: requestLimitPerCollection,
    }),

    getCollectionItems({
      type: "description",
      userId,
      cursorDocId: descriptionCursor,
      limit: requestLimitPerCollection,
    }),

    getCollectionItems({
      type: "photo",
      userId,
      cursorDocId: photoCursor,
      limit: requestLimitPerCollection,
    }),

    getCollectionItems({
      type: "report",
      userId,
      cursorDocId: reportCursor,
      limit: requestLimitPerCollection,
    }),
  ]);

  const mergedItems = [
    ...placeItems,
    ...descriptionItems,
    ...photoItems,
    ...reportItems,
  ].sort(
    (a, b) =>
      b.createdAtMs - a.createdAtMs
  );

  const pageItems =
    mergedItems.slice(0, safeLimit);

  const usedByType = {
    place: pageItems.filter(
      (item) => item.type === "place"
    ),

    description: pageItems.filter(
      (item) => item.type === "description"
    ),

    photo: pageItems.filter(
      (item) => item.type === "photo"
    ),

    report: pageItems.filter(
      (item) => item.type === "report"
    ),
  };

  const nextCursorPayload = {
    place:
      usedByType.place.length > 0
        ? usedByType.place[
            usedByType.place.length - 1
          ].id
        : placeCursor,

    description:
      usedByType.description.length > 0
        ? usedByType.description[
            usedByType.description.length - 1
          ].id
        : descriptionCursor,

    photo:
      usedByType.photo.length > 0
        ? usedByType.photo[
            usedByType.photo.length - 1
          ].id
        : photoCursor,

    report:
      usedByType.report.length > 0
        ? usedByType.report[
            usedByType.report.length - 1
          ].id
        : reportCursor,
  };

  const hasMore =
    placeItems.length >
      usedByType.place.length ||
    descriptionItems.length >
      usedByType.description.length ||
    photoItems.length >
      usedByType.photo.length ||
    reportItems.length >
      usedByType.report.length;

  const cleanedItems = pageItems.map(
    ({ createdAtMs, ...item }) => item
  );

  return {
    history: cleanedItems,
    count: cleanedItems.length,
    hasMore,
    nextCursor: hasMore
      ? encodeCursor(nextCursorPayload)
      : null,
    limit: safeLimit,
  };
}