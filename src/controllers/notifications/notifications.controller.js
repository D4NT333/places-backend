import {
  savePushTokenService,
} from "../../services/notifications/savePushToken.service.js";

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