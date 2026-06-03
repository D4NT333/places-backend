import { savePushTokenService } from "../../services/notifications/savePushToken.service.js";
import { sendPushNotificationToUserService } from "../../services/notifications/sendPushNotificationToUser.service.js";
import { createUserNotificationService } from "../../services/notifications/createUserNotification.service.js";

export async function savePushTokenController(req, res, next) {
  try {
    const uid = req.user?.uid;
    const { expoPushToken, platform } = req.body;

    const result = await savePushTokenService({
      uid,
      expoPushToken,
      platform,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function sendTestPushNotificationController(req, res, next) {
  try {
    const uid = req.user?.uid;

    await createUserNotificationService({
      uid,
      type: "test_notification",
      title: "Notificación de prueba",
      body: "Si ves esto, las notificaciones de Lsearch ya jalan.",
      data: {
        screen: "Notifications",
      },
    });

    const result = await sendPushNotificationToUserService({
      uid,
      title: "Notificación de prueba",
      body: "Si ves esto, las notificaciones de Lsearch ya jalan.",
      data: {
        screen: "Notifications",
        type: "test_notification",
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}