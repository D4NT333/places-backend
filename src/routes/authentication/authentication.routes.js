import { Router } from "express";
import createSessionController from "../../controllers/authentication/createSession.controller.js";
import getAdminMeController from "../../controllers/authentication/getAdminMe.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

router.post("/session", createSessionController);

router.get("/admin/me", verifyFirebaseToken, getAdminMeController);

export default router;