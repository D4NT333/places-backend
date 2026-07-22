import { Router } from "express";

import {
  savePushTokenController,
} from "../../controllers/notifications/notifications.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

router.post("/push-token", verifyFirebaseToken, savePushTokenController);


export default router;