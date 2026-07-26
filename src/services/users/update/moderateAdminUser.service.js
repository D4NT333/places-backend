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

function normalizeModerationType(value) {
  const normalizedValue = String(
    value || "",
  )
    .trim()
    .toLowerCase();

  /*
   * El modal todavía puede mandar "permanent".
   * Lo convertimos al valor del backend.
   */
  if (
    normalizedValue === "permanent"
  ) {
    return MODERATION_TYPES
      .PERMANENT_BAN;
  }

  return normalizedValue;
}

export default async function moderateAdminUserService({
  userId,
  moderationType,
  reason,
  reasonLabel,
  message,
  adminUid,
}) {
  const cleanUserId = String(
    userId || "",
  ).trim();

  const cleanAdminUid = String(
    adminUid || "",
  ).trim();

  const cleanModerationType =
    normalizeModerationType(
      moderationType,
    );

  const cleanReason = String(
    reason || "",
  ).trim();

  const cleanReasonLabel = String(
    reasonLabel ||
      reason ||
      "",
  ).trim();

  const cleanMessage = String(
    message || "",
  ).trim();

  if (!cleanUserId) {
    throw createServiceError(
      "El identificador del usuario es obligatorio.",
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
    cleanModerationType !==
      MODERATION_TYPES.WARNING &&
    cleanModerationType !==
      MODERATION_TYPES.PERMANENT_BAN
  ) {
    throw createServiceError(
      "El tipo de moderación no es válido.",
      400,
    );
  }

  if (!cleanReason) {
    throw createServiceError(
      "El motivo de la medida es obligatorio.",
      400,
    );
  }

  if (
    cleanMessage.length < 10
  ) {
    throw createServiceError(
      "La explicación debe tener al menos 10 caracteres.",
      400,
    );
  }

  if (
    cleanMessage.length > 500
  ) {
    throw createServiceError(
      "La explicación no puede superar los 500 caracteres.",
      400,
    );
  }

  if (
    cleanUserId === cleanAdminUid
  ) {
    throw createServiceError(
      "Un administrador no puede moderar su propia cuenta.",
      400,
    );
  }

  const now = Timestamp.now();

  const userRef = db
    .collection("user")
    .doc(cleanUserId);

  const moderationHistoryRef =
    userRef
      .collection("moderationHistory")
      .doc();

  const transactionResult =
    await db.runTransaction(
      async (transaction) => {
        const userSnapshot =
          await transaction.get(
            userRef,
          );

        if (!userSnapshot.exists) {
          throw createServiceError(
            "El usuario no existe.",
            404,
          );
        }

        const user =
          userSnapshot.data();

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

        if (
          previousStatus ===
          USER_STATUSES.BANNED
        ) {
          throw createServiceError(
            "El usuario ya está bloqueado permanentemente.",
            409,
          );
        }

        const isPermanentBan =
          cleanModerationType ===
          MODERATION_TYPES
            .PERMANENT_BAN;

        /*
         * El bloqueo manual no suma una
         * advertencia falsa al contador.
         */
        const nextWarningCount =
          isPermanentBan
            ? currentWarningCount
            : currentWarningCount + 1;

        const resultingStatus =
          isPermanentBan
            ? USER_STATUSES.BANNED
            : getUserStatusFromWarningCount(
                nextWarningCount,
              );

        const becameBanned =
          resultingStatus ===
          USER_STATUSES.BANNED;

        transaction.set(
          moderationHistoryRef,
          {
            moderationId:
              moderationHistoryRef.id,

            userId:
              cleanUserId,

            type:
              cleanModerationType,

            source:
              MODERATION_SOURCES.MANUAL,

            reason:
              cleanReason,

            reasonLabel:
              cleanReasonLabel ||
              cleanReason,

            message:
              cleanMessage,

            warningNumber:
              isPermanentBan
                ? null
                : nextWarningCount,

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

          "moderation.updatedAt":
            now,

          updatedAt:
            now,
        };

        if (!isPermanentBan) {
          userUpdates[
            "moderation.lastWarningAt"
          ] = now;

          userUpdates[
            "moderation.lastWarningReason"
          ] = cleanReason;
        }

        if (becameBanned) {
          userUpdates[
            "moderation.bannedAt"
          ] = now;

          userUpdates[
            "moderation.bannedBy"
          ] = cleanAdminUid;

          userUpdates[
            "moderation.banReason"
          ] = isPermanentBan
            ? cleanReason
            : "repeated_violations";
        }

        transaction.update(
          userRef,
          userUpdates,
        );

        return {
          moderationId:
            moderationHistoryRef.id,

          moderationType:
            cleanModerationType,

          warningCount:
            nextWarningCount,

          previousStatus,
          resultingStatus,

          becameBanned,

          shouldDisableAuth:
            resultingStatus ===
            USER_STATUSES.BANNED,
        };
      },
    );

  /*
   * Si quedó baneado, bloqueamos Authentication.
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
   * Se envía fuera de la transacción para evitar
   * notificaciones duplicadas.
   */
  let notificationResult = null;

  try {
    notificationResult =
      await sendUserModerationNotificationService({
        uid:
          cleanUserId,

        moderationId:
          transactionResult.moderationId,

        moderationType:
          transactionResult.moderationType,

        warningCount:
          transactionResult.warningCount,

        reason:
          cleanReason,

        reasonLabel:
          cleanReasonLabel ||
          cleanReason,

        message:
          cleanMessage,

        source:
          MODERATION_SOURCES.MANUAL,

        reportId:
          null,
      });
  } catch (error) {
    console.error(
      "Error enviando notificación de moderación manual:",
      error,
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