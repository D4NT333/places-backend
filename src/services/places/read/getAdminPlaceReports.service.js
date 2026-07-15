import {
  FieldPath,
} from "firebase-admin/firestore";

import { db } from "../../../config/firebase.js";

import {
  decodeCursor,
  encodeCursor,
  getDateMillis,
  millisToTimestamp,
  serializeDate,
} from "../../../utils/firestorePagination.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const ALLOWED_STATUSES = new Set([
  "all",
  "pending",
  "in_review",
  "resolved",
  "dismissed",
]);

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeLimit(value) {
  const parsedLimit = Number(value);

  if (!Number.isInteger(parsedLimit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(parsedLimit, 1),
    MAX_LIMIT,
  );
}

function normalizeReport(snapshot) {
  const report = snapshot.data();

  return {
    reportId: report.reportId || snapshot.id,

    target: report.reportTarget || null,

    reason: {
      id: report.reasonId || null,
      label: report.reasonLabel || null,
    },

    message: report.message || "",
    priority: report.priority || "normal",
    status: report.status || "pending",

    source:
  report.source ||
  "place_detail",

    place: {
      placeId: report.place?.placeId || null,
      placeName: report.place?.placeName || null,
    },

    reporter: {
      uid: report.reporter?.uid || null,
      name:
        report.reporter?.name ||
        "Usuario",

      email:
        report.reporter?.email || null,

      photoURL:
        report.reporter?.photoURL || null,
    },

    reportedUser: report.reportedUser
      ? {
          uid:
            report.reportedUser.uid || null,

          name:
            report.reportedUser.name || null,

          email:
            report.reportedUser.email || null,

          photoURL:
            report.reportedUser.photoURL ||
            null,
        }
      : null,

    review: report.review
      ? {
          reviewId:
            report.review.reviewId || null,

          rating:
            Number(report.review.rating) ||
            null,

          source:
            report.review.source || null,
        }
      : null,

    admin: {
      assignedTo:
        report.admin?.assignedTo || null,

      resolutionNote:
        report.admin?.resolutionNote || "",

      resolvedBy:
        report.admin?.resolvedBy || null,

      resolvedAt: serializeDate(
        report.admin?.resolvedAt,
      ),
    },

    metadata: {
      app: report.metadata?.app || null,

      createdFrom:
        report.metadata?.createdFrom || null,
    },

    createdAt: serializeDate(
      report.createdAt,
    ),

    updatedAt: serializeDate(
      report.updatedAt,
    ),

    deletedAt: serializeDate(
      report.deletedAt,
    ),
  };
}

export default async function getAdminPlaceReportsService({
  placeId,
  limit,
  cursor,
  status = "all",
}) {
  if (!placeId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  if (!ALLOWED_STATUSES.has(status)) {
    throw createHttpError(
      "El estado solicitado no es válido.",
      400,
    );
  }

  const normalizedLimit = normalizeLimit(limit);
  const decodedCursor = decodeCursor(cursor);

  let query = db
    .collection("reports")
    .where("reportTarget", "==", "place")
    .where("place.placeId", "==", placeId)
    .where("deletedAt", "==", null);

  if (status !== "all") {
    query = query.where(
      "status",
      "==",
      status,
    );
  }

  query = query
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(normalizedLimit + 1);

  if (decodedCursor) {
    if (
      !decodedCursor.createdAt ||
      !decodedCursor.id
    ) {
      throw createHttpError(
        "El cursor de reportes no es válido.",
        400,
      );
    }

    query = query.startAfter(
      millisToTimestamp(
        decodedCursor.createdAt,
      ),
      decodedCursor.id,
    );
  }

  const snapshot = await query.get();

  const hasMore =
    snapshot.docs.length > normalizedLimit;

  const pageDocuments = hasMore
    ? snapshot.docs.slice(0, normalizedLimit)
    : snapshot.docs;

  const reports =
    pageDocuments.map(normalizeReport);

  const lastDocument =
    pageDocuments[pageDocuments.length - 1];

  const nextCursor =
    hasMore && lastDocument
      ? encodeCursor({
          id: lastDocument.id,

          createdAt: getDateMillis(
            lastDocument.data().createdAt,
          ),
        })
      : null;

  return {
    reports,

    pagination: {
      limit: normalizedLimit,
      nextCursor,
      hasMore,
    },
  };
}