import { Router } from "express";

import {
  savePushTokenController,
  getUserNotificationsController,
  markUserNotificationReadController,
} from "../../controllers/notifications/notifications.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

router.post("/push-token", verifyFirebaseToken, savePushTokenController);

router.get("/",verifyFirebaseToken,getUserNotificationsController);

router.patch("/:notificationId/read",verifyFirebaseToken,markUserNotificationReadController);

export default router;