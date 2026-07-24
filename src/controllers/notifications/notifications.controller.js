import {
  savePushTokenService,
} from "../../services/notifications/savePushToken.service.js";

import {
  getUserNotificationsService,
} from "../../services/notifications/getUserNotifications.service.js";

import {
  markUserNotificationReadService,
} from "../../services/notifications/markUserNotificationRead.service.js";

export async function savePushTokenController(
  req,
  res,
  next,
) {
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

export async function getUserNotificationsController(
  req,
  res,
  next,
) {
  try {
    const uid = req.user?.uid;
    const { limit } = req.query;

    const result =
      await getUserNotificationsService({
        uid,
        limit,
      });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function markUserNotificationReadController(
  req,
  res,
  next,
) {
  try {
    const uid = req.user?.uid;
    const { notificationId } = req.params;

    const result =
      await markUserNotificationReadService({
        uid,
        notificationId,
      });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}