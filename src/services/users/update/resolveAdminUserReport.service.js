import {
  Timestamp,
} from "firebase-admin/firestore";

import {
  auth,
  db,
} from "../../../config/firebase.js";

import {
  getUserStatusFromWarningCount,
  MAX_WARNINGS,
  MODERATION_SOURCES,
  MODERATION_TYPES,
  normalizeWarningCount,
  USER_STATUSES,
} from "../../../utils/userModeration.js";

import sendUserModerationNotificationService from "../../notifications/create/sendUserModerationNotification.service.js";

function createServiceError(
  message,
  statusCode,
) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
}

function normalizeDecision(value) {
  const normalizedValue = String(
    value || "",
  )
    .trim()
    .toLowerCase();

  /*
   * El modal manda dismissed.
   * Internamente guardamos discarded.
   */
  if (
    normalizedValue === "dismissed"
  ) {
    return "discarded";
  }

  return normalizedValue;
}

function getReportedUserId(report) {
  return (
    report?.reportedUser?.uid ||
    report?.reportedUserId ||
    report?.relatedTo?.id ||
    null
  );
}

export default async function resolveAdminUserReportService({
  userId,
  reportId,
  decision,
  resolutionNote,
  adminUid,
}) {
  const cleanUserId = String(
    userId || "",
  ).trim();

  const cleanReportId = String(
    reportId || "",
  ).trim();

  const cleanAdminUid = String(
    adminUid || "",
  ).trim();

  const cleanDecision =
    normalizeDecision(decision);

  const cleanResolutionNote = String(
    resolutionNote || "",
  ).trim();

  if (!cleanUserId) {
    throw createServiceError(
      "El identificador del usuario es obligatorio.",
      400,
    );
  }

  if (!cleanReportId) {
    throw createServiceError(
      "El identificador del reporte es obligatorio.",
      400,
    );
  }

  if (!cleanAdminUid) {
    throw createServiceError(
      "No se encontró al administrador autenticado.",
      401,
    );
  }

  if (
    cleanDecision !== "resolved" &&
    cleanDecision !== "discarded"
  ) {
    throw createServiceError(
      "La decisión debe ser resolved o discarded.",
      400,
    );
  }

  if (
    cleanResolutionNote.length < 10
  ) {
    throw createServiceError(
      "La nota de resolución debe tener al menos 10 caracteres.",
      400,
    );
  }

  if (
    cleanResolutionNote.length > 500
  ) {
    throw createServiceError(
      "La nota de resolución no puede superar los 500 caracteres.",
      400,
    );
  }

  const now = Timestamp.now();

  const userRef = db
    .collection("user")
    .doc(cleanUserId);

  const reportRef = db
    .collection("reports")
    .doc(cleanReportId);

  /*
   * La referencia se genera fuera de la transacción
   * para conservar el ID si Firestore reintenta.
   */
  const moderationHistoryRef =
    userRef
      .collection("moderationHistory")
      .doc();

  const transactionResult =
    await db.runTransaction(
      async (transaction) => {
        const [
          userSnapshot,
          reportSnapshot,
        ] = await Promise.all([
          transaction.get(userRef),
          transaction.get(reportRef),
        ]);

        if (!userSnapshot.exists) {
          throw createServiceError(
            "El usuario reportado no existe.",
            404,
          );
        }

        if (!reportSnapshot.exists) {
          throw createServiceError(
            "El reporte no existe.",
            404,
          );
        }

        const user =
          userSnapshot.data();

        const report =
          reportSnapshot.data();

        const reportTarget = String(
          report.reportTarget ||
            report.target ||
            "",
        )
          .trim()
          .toLowerCase();

        if (reportTarget !== "user") {
          throw createServiceError(
            "El reporte no corresponde a un usuario.",
            400,
          );
        }

        const reportedUserId =
          getReportedUserId(report);

        if (
          reportedUserId !== cleanUserId
        ) {
          throw createServiceError(
            "El reporte no pertenece al usuario indicado.",
            403,
          );
        }

        const currentReportStatus =
          String(
            report.status || "pending",
          )
            .trim()
            .toLowerCase();

        if (
          currentReportStatus ===
            "resolved" ||
          currentReportStatus ===
            "discarded" ||
          currentReportStatus ===
            "dismissed"
        ) {
          throw createServiceError(
            "Este reporte ya fue resuelto.",
            409,
          );
        }

        const previousStatus =
          String(
            user.status ||
              USER_STATUSES.ACTIVE,
          )
            .trim()
            .toLowerCase();

        const currentWarningCount =
          normalizeWarningCount(
            user.moderation
              ?.warningCount,
          );

        /*
         * Descartar:
         * no cambia usuario ni contador.
         */
        if (
          cleanDecision ===
          "discarded"
        ) {
          transaction.update(
            reportRef,
            {
              status:
                "discarded",

              "admin.resolutionNote":
                cleanResolutionNote,

              "admin.resolvedAt":
                now,

              "admin.resolvedBy":
                cleanAdminUid,

              updatedAt:
                now,
            },
          );

          return {
            reportId:
              cleanReportId,

            decision:
              "discarded",

            warningApplied:
              false,

            warningCount:
              currentWarningCount,

            previousStatus,

            resultingStatus:
              previousStatus,

            becameBanned:
              false,

            shouldDisableAuth:
              false,
          };
        }

        /*
         * Validar:
         * incrementa advertencia.
         */
        const nextWarningCount =
          currentWarningCount + 1;

        const calculatedStatus =
          getUserStatusFromWarningCount(
            nextWarningCount,
          );

        const resultingStatus =
          previousStatus ===
          USER_STATUSES.BANNED
            ? USER_STATUSES.BANNED
            : calculatedStatus;

        const becameBanned =
          previousStatus !==
            USER_STATUSES.BANNED &&
          resultingStatus ===
            USER_STATUSES.BANNED;

        const reportReason =
          report.reasonId ||
          report.reason ||
          "validated_report";

        const reportReasonLabel =
          report.reasonLabel ||
          report.reason ||
          "Reporte validado";

        transaction.update(
          reportRef,
          {
            status:
              "resolved",

            "admin.resolutionNote":
              cleanResolutionNote,

            "admin.resolvedAt":
              now,

            "admin.resolvedBy":
              cleanAdminUid,

            moderationApplied:
              true,

            moderationHistoryId:
              moderationHistoryRef.id,

            updatedAt:
              now,
          },
        );

        transaction.set(
          moderationHistoryRef,
          {
            moderationId:
              moderationHistoryRef.id,

            userId:
              cleanUserId,

            type:
              MODERATION_TYPES.WARNING,

            source:
              MODERATION_SOURCES
                .VALIDATED_REPORT,

            reportId:
              cleanReportId,

            reason:
              reportReason,

            reasonLabel:
              reportReasonLabel,

            message:
              cleanResolutionNote,

            warningNumber:
              nextWarningCount,

            previousStatus,
            resultingStatus,

            appliedBy:
              cleanAdminUid,

            appliedAt:
              now,
          },
        );

        const userUpdates = {
          status:
            resultingStatus,

          "moderation.warningCount":
            nextWarningCount,

          "moderation.lastWarningAt":
            now,

          "moderation.lastWarningReason":
            reportReason,

          "moderation.updatedAt":
            now,

          updatedAt:
            now,
        };

        if (becameBanned) {
          userUpdates[
            "moderation.bannedAt"
          ] = now;

          userUpdates[
            "moderation.bannedBy"
          ] = cleanAdminUid;

          userUpdates[
            "moderation.banReason"
          ] = "repeated_violations";
        }

        transaction.update(
          userRef,
          userUpdates,
        );

        return {
          reportId:
            cleanReportId,

          decision:
            "resolved",

          warningApplied:
            true,

          moderationId:
            moderationHistoryRef.id,

          warningCount:
            nextWarningCount,

          previousStatus,
          resultingStatus,

          becameBanned,

          reason:
            reportReason,

          reasonLabel:
            reportReasonLabel,

          shouldDisableAuth:
            resultingStatus ===
            USER_STATUSES.BANNED,
        };
      },
    );

  /*
   * Si llegó a cuatro advertencias,
   * se bloquea Firebase Authentication.
   */
  if (
    transactionResult.shouldDisableAuth
  ) {
    await auth.updateUser(
      cleanUserId,
      {
        disabled: true,
      },
    );

    await auth.revokeRefreshTokens(
      cleanUserId,
    );

    await userRef.set(
      {
        moderation: {
          authDisabledAt:
            Timestamp.now(),
        },
      },
      {
        merge: true,
      },
    );
  }

  /*
   * Solo se notifica cuando el reporte fue validado.
   * Los reportes descartados no generan sanción ni mensaje.
   */
  let notificationResult = null;

if (
  transactionResult.warningApplied
) {
  console.log(
    "Enviando notificación por reporte validado:",
    {
      uid:
        cleanUserId,

      moderationId:
        transactionResult.moderationId,

      moderationType:
        transactionResult.resultingStatus ===
        USER_STATUSES.BANNED
          ? MODERATION_TYPES.PERMANENT_BAN
          : MODERATION_TYPES.WARNING,

      warningCount:
        transactionResult.warningCount,

      reportId:
        cleanReportId,
    },
  );

  notificationResult =
    await sendUserModerationNotificationService({
      uid:
        cleanUserId,

      moderationId:
        transactionResult.moderationId,

      moderationType:
        transactionResult.resultingStatus ===
        USER_STATUSES.BANNED
          ? MODERATION_TYPES.PERMANENT_BAN
          : MODERATION_TYPES.WARNING,

      warningCount:
        transactionResult.warningCount,

      reason:
        transactionResult.reason ||
        "validated_report",

      reasonLabel:
        transactionResult.reasonLabel ||
        "Reporte validado",

      message:
        cleanResolutionNote,

      source:
        MODERATION_SOURCES
          .VALIDATED_REPORT,

      reportId:
        cleanReportId,
    });

  console.log(
    "Resultado notificación por reporte:",
    notificationResult,
  );
}

return {
  ok: true,

  userId:
    cleanUserId,

  maxWarnings:
    MAX_WARNINGS,

  ...transactionResult,

  notificationResult,
};
}