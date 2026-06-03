import { Router } from "express";

import {
  savePushTokenController,
  sendTestPushNotificationController,
} from "../../controllers/notifications/notifications.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

router.post("/push-token", verifyFirebaseToken, savePushTokenController);
router.post("/test", verifyFirebaseToken, sendTestPushNotificationController);

export default router;