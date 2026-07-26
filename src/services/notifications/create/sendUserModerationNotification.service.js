import {createUserNotificationService} from "../createUserNotification.service.js";

import {sendPushNotificationToUserService} from "../sendPushNotificationToUser.service.js";

function normalizeWarningCount(value) {
  const parsedValue =
    Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(
    Math.trunc(parsedValue),
    0,
  );
}

function getUserModerationNotification({
  moderationType,
  warningCount,
}) {
  const normalizedWarningCount =
    normalizeWarningCount(
      warningCount,
    );

  const isBanned =
    moderationType ===
      "permanent_ban" ||
    normalizedWarningCount >= 4;

  if (isBanned) {
    return {
      notificationType:
        "account_permanently_banned",

      title:
        "Tu cuenta fue bloqueada",

      body:
        "Tu cuenta fue bloqueada permanentemente por incumplir las normas de Lsearch.",
    };
  }

  if (
    normalizedWarningCount === 1
  ) {
    return {
      notificationType:
        "account_warning",

      title:
        "Advertencia sobre tu cuenta",

      body:
        "Tu cuenta recibió una advertencia. Revisa las normas para evitar nuevas sanciones.",

      shouldSendEmail:
        false,
    };
  }

  if (
    normalizedWarningCount === 2
  ) {
    return {
      notificationType:
        "account_warning",

      title:
        "Segunda advertencia",

      body:
        "Tu cuenta recibió una segunda advertencia. Nuevas infracciones pueden provocar el bloqueo de tu cuenta.",

      shouldSendEmail:
        false,
    };
  }

  return {
    notificationType:
      "account_final_warning",

    title:
      "Advertencia final",

    body:
      "Tu cuenta recibió la advertencia final. Una nueva infracción confirmada bloqueará permanentemente tu cuenta.",

    shouldSendEmail:
      false,
  };
}

export default async function sendUserModerationNotificationService({
  uid,

  moderationId,
  moderationType,

  warningCount,

  reason,
  reasonLabel,
  message,

  source,
  reportId = null,
}) {
  const cleanUid =
    String(uid || "").trim();

  if (!cleanUid) {
    throw new Error(
      "El usuario es obligatorio para crear la notificación.",
    );
  }

  const notification =
    getUserModerationNotification({
      moderationType,
      warningCount,
    });

  const data = {
    screen:
      "AccountModeration",

    moderationId:
      moderationId || "",

    moderationType:
      moderationType || "",

    warningCount:
      String(
        warningCount ?? 0,
      ),

    reason:
      reason || "",

    reasonLabel:
      reasonLabel || "",

    message:
      message || "",

    source:
      source || "manual",

    reportId:
      reportId || "",
  };

  /*
   * Esta es la fuente de verdad visible
   * dentro de NotificationsScreen.
   */
  const storedNotification =
    await createUserNotificationService({
      uid:
        cleanUid,

      type:
        notification.notificationType,

      title:
        notification.title,

      body:
        notification.body,

      data,
    });

  /*
   * Si el push falla, la notificación interna
   * ya quedó registrada.
   */
  let pushResult = null;

  try {
    pushResult =
      await sendPushNotificationToUserService({
        uid:
          cleanUid,

        title:
          notification.title,

        body:
          notification.body,

        data,
      });
  } catch (error) {
    console.error(
      "No se pudo enviar push de moderación:",
      error,
    );
  }


  return {
    notification:
      storedNotification ||
      null,

    push:
      pushResult,
  };
}