import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const REPORT_DECISIONS = new Set([
  "resolved",
  "dismissed",
]);

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    Math.trunc(parsed),
    0
  );
}

/*
 * Calcula automáticamente el estado de moderación
 * de acuerdo con la cantidad de reportes válidos.
 *
 * 0 reportes      -> published
 * 1 o 2 reportes  -> in_review
 * 3 reportes      -> warned
 * 4 o más         -> hidden
 */
function getPlaceModerationStatus(
  validReportsCount
) {
  const count = Math.max(
    Math.trunc(
      Number(validReportsCount) || 0
    ),
    0
  );

  if (count >= 4) {
    return "hidden";
  }

  if (count >= 3) {
    return "warned";
  }

  if (count >= 1) {
    return "in_review";
  }

  return "published";
}

async function assertAdminUser(uid) {
  if (!uid) {
    throw createHttpError(
      "Usuario no autenticado.",
      401
    );
  }

  const adminSnapshot = await db
    .collection("adminUsers")
    .doc(uid)
    .get();

  if (!adminSnapshot.exists) {
    throw createHttpError(
      "No tienes permisos administrativos.",
      403
    );
  }

  return adminSnapshot.data();
}

function getReportTarget(report) {
  return cleanText(
    report.reportTarget ||
    report.target ||
    report.type
  ).toLowerCase();
}

function getReportPlaceId(report) {
  return cleanText(
    report.place?.placeId ||
    report.placeId ||
    report.metadata?.placeId
  );
}

export default async function resolveAdminPlaceReportService({
  adminUid,
  placeId,
  reportId,
  decision,
  resolutionNote,
}) {
  await assertAdminUser(adminUid);

  const normalizedPlaceId =
    cleanText(placeId);

  const normalizedReportId =
    cleanText(reportId);

  const normalizedDecision =
    cleanText(decision).toLowerCase();

  const normalizedResolutionNote =
    cleanText(resolutionNote);

  if (!normalizedPlaceId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400
    );
  }

  if (!normalizedReportId) {
    throw createHttpError(
      "El identificador del reporte es obligatorio.",
      400
    );
  }

  if (
    !REPORT_DECISIONS.has(
      normalizedDecision
    )
  ) {
    throw createHttpError(
      "La decisión debe ser resolved o dismissed.",
      400
    );
  }

  if (
    normalizedResolutionNote.length < 10
  ) {
    throw createHttpError(
      "La nota de resolución debe tener al menos 10 caracteres.",
      400
    );
  }

  if (
    normalizedResolutionNote.length > 500
  ) {
    throw createHttpError(
      "La nota de resolución no puede superar 500 caracteres.",
      400
    );
  }

  const placeRef = db
    .collection("places")
    .doc(normalizedPlaceId);

  const reportRef = db
    .collection("reports")
    .doc(normalizedReportId);

  const moderationActionRef = placeRef
    .collection("moderationActions")
    .doc();

  const result = await db.runTransaction(
    async (transaction) => {
      const [
        placeSnapshot,
        reportSnapshot,
      ] = await Promise.all([
        transaction.get(placeRef),
        transaction.get(reportRef),
      ]);

      if (!placeSnapshot.exists) {
        throw createHttpError(
          "No se encontró el lugar.",
          404
        );
      }

      if (!reportSnapshot.exists) {
        throw createHttpError(
          "No se encontró el reporte.",
          404
        );
      }

      const place =
        placeSnapshot.data();

      const report =
        reportSnapshot.data();

      const reportPlaceId =
        getReportPlaceId(report);

      if (
        reportPlaceId &&
        reportPlaceId !== normalizedPlaceId
      ) {
        throw createHttpError(
          "El reporte no pertenece al lugar indicado.",
          409
        );
      }

      if (
        report.status === "resolved" ||
        report.status === "dismissed"
      ) {
        throw createHttpError(
          "Este reporte ya fue resuelto.",
          409
        );
      }

      const reportTarget =
        getReportTarget(report);

      /*
       * Solamente los reportes dirigidos
       * directamente al lugar modifican
       * su estado de moderación.
       */
      const affectsPlace =
        reportTarget === "place";

      const currentValidReportsCount =
        normalizeCount(
          place.moderation
            ?.validReportsCount ??
          place.metrics
            ?.validReportsCount
        );

      const currentDismissedReportsCount =
        normalizeCount(
          place.moderation
            ?.dismissedReportsCount ??
          place.metrics
            ?.dismissedReportsCount
        );

      const isResolved =
        normalizedDecision === "resolved";

      const increasesValidReports =
        isResolved && affectsPlace;

      const nextValidReportsCount =
        increasesValidReports
          ? currentValidReportsCount + 1
          : currentValidReportsCount;

      const nextDismissedReportsCount =
        normalizedDecision === "dismissed"
          ? currentDismissedReportsCount + 1
          : currentDismissedReportsCount;

      const currentModerationStatus =
        cleanText(place.status) ||
        "published";

      const nextModerationStatus =
        increasesValidReports
          ? getPlaceModerationStatus(
              nextValidReportsCount
            )
          : currentModerationStatus;

      transaction.update(
        reportRef,
        {
          status:
            normalizedDecision,

          "admin.resolutionNote":
            normalizedResolutionNote,

          "admin.resolvedBy":
            adminUid,

          "admin.resolvedAt":
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      const placeUpdates = {
        "moderation.validReportsCount":
          nextValidReportsCount,

        "moderation.dismissedReportsCount":
          nextDismissedReportsCount,

        "metrics.validReportsCount":
          nextValidReportsCount,

        "metrics.dismissedReportsCount":
          nextDismissedReportsCount,

        updatedAt:
          FieldValue.serverTimestamp(),
      };

      if (increasesValidReports) {
        placeUpdates.status =
          nextModerationStatus;

        placeUpdates[
          "moderation.status"
        ] = nextModerationStatus;

        placeUpdates[
          "moderation.source"
        ] = "reports";

        placeUpdates[
          "moderation.lastValidatedReportId"
        ] = normalizedReportId;

        placeUpdates[
          "moderation.lastReportValidatedAt"
        ] = FieldValue.serverTimestamp();

        placeUpdates[
          "moderation.updatedAt"
        ] = FieldValue.serverTimestamp();
      }

      transaction.update(
        placeRef,
        placeUpdates
      );

      transaction.set(
        moderationActionRef,
        {
          actionId:
            moderationActionRef.id,

          placeId:
            normalizedPlaceId,

          type:
            normalizedDecision === "resolved"
              ? "report_validated"
              : "report_dismissed",

          source:
            "report",

          reportId:
            normalizedReportId,

          reportTarget:
            reportTarget || null,

          affectsPlace,

          previousStatus:
            currentModerationStatus,

          nextStatus:
            nextModerationStatus,

          previousValidReportsCount:
            currentValidReportsCount,

          nextValidReportsCount,

          resolutionNote:
            normalizedResolutionNote,

          performedBy:
            adminUid,

          createdAt:
            FieldValue.serverTimestamp(),
        }
      );

      return {
        reportId:
          normalizedReportId,

        placeId:
          normalizedPlaceId,

        decision:
          normalizedDecision,

        reportTarget:
          reportTarget || null,

        affectsPlace,

        moderation: {
          previousStatus:
            currentModerationStatus,

          status:
            nextModerationStatus,

          validReportsCount:
            nextValidReportsCount,

          dismissedReportsCount:
            nextDismissedReportsCount,
        },
      };
    }
  );

  return result;
}