import { db } from "../../../config/firebase.js";

const REPORT_STATUS_LABELS = {
  pending: "Pendiente",
  resolved: "Resuelto",
  discarded: "Descartado",
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

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
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

function normalizeStatus(status) {
  return REPORT_STATUS_LABELS[status]
    ? status
    : "pending";
}

function normalizeReportDoc(doc) {
  const data = doc.data();

  const status = normalizeStatus(data.status);
  const createdAt = data.createdAt || data.updatedAt;

  return {
    id: doc.id,
    reportId: data.reportId || doc.id,

    reportTarget:
      data.reportTarget ||
      data.target ||
      "user",

    reason:
      data.reasonLabel ||
      data.reason ||
      "Reporte recibido",

    reasonId:
      data.reasonId ||
      null,

    message:
      data.message ||
      "Sin descripción",

    status,
    statusLabel:
      REPORT_STATUS_LABELS[status] ||
      "Pendiente",

    priority:
      data.priority ||
      null,

    reportedUser: {
      uid:
        data.reportedUser?.uid ||
        data.reportedUserId ||
        null,

      name:
        data.reportedUser?.name ||
        "Usuario",

      photoURL:
        data.reportedUser?.photoURL ||
        null,
    },

    createdBy: {
      uid:
        data.createdBy?.uid ||
        null,

      name:
        data.createdBy?.name ||
        "Usuario",

      photoURL:
        data.createdBy?.photoURL ||
        null,
    },

    place: data.place
      ? {
          placeId:
            data.place.placeId ||
            null,

          placeName:
            data.place.placeName ||
            "Sin lugar",
        }
      : null,

    createdAt: serializeDate(createdAt),
    createdAtMs:
      toDate(createdAt)?.getTime?.() || 0,
  };
}

export default async function getAdminUserReportsService({
  userId,
  limit = 15,
  cursor = null,
}) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 15, 1),
    30
  );

  const decodedCursor = decodeCursor(cursor);
  const cursorCreatedAtMs =
    decodedCursor?.createdAtMs || null;
  const cursorId = decodedCursor?.id || null;

  /*
    Buscamos únicamente reportes dirigidos
    al usuario seleccionado.
  */
  const snapshot = await db
    .collection("reports")
    .where("reportedUser.uid", "==", userId)
    .get();

  let reports = snapshot.docs
    .map(normalizeReportDoc)
    .filter(
      (report) =>
        report.reportTarget === "user"
    )
    .sort((firstReport, secondReport) => {
      if (
        secondReport.createdAtMs !==
        firstReport.createdAtMs
      ) {
        return (
          secondReport.createdAtMs -
          firstReport.createdAtMs
        );
      }

      return secondReport.id.localeCompare(
        firstReport.id
      );
    });

  /*
    Aplicamos el cursor después de ordenar.

    Esto evita necesitar un índice compuesto
    de Firestore para reportedUser.uid + createdAt.
  */
  if (cursorCreatedAtMs && cursorId) {
    const cursorIndex = reports.findIndex(
      (report) =>
        report.createdAtMs ===
          cursorCreatedAtMs &&
        report.id === cursorId
    );

    if (cursorIndex >= 0) {
      reports = reports.slice(cursorIndex + 1);
    }
  }

  const pageItems = reports.slice(
    0,
    safeLimit
  );

  const hasMore =
    reports.length > pageItems.length;

  const lastItem =
    pageItems[pageItems.length - 1];

  const cleanedReports = pageItems.map(
    ({ createdAtMs, ...report }) => report
  );

  return {
    reports: cleanedReports,
    count: cleanedReports.length,

    hasMore,

    nextCursor:
      hasMore && lastItem
        ? encodeCursor({
            id: lastItem.id,
            createdAtMs:
              lastItem.createdAtMs,
          })
        : null,

    limit: safeLimit,

    emptyMessage:
      cleanedReports.length === 0
        ? "Este usuario no tiene reportes recibidos."
        : null,
  };
}