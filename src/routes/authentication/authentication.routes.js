import { Router } from "express";
import createSessionController from "../../controllers/authentication/createSession.controller.js";
import getAdminMeController from "../../controllers/authentication/getAdminMe.controller.js";
import checkRegisterAvailabilityController from "../../controllers/authentication/checkRegisterAvailability.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

import {registerEmailUserController} from "../../controllers/authentication/registerEmailUser.controller.js";


import { checkLoginMethodController } from "../../controllers/authentication/checkLoginMethod.controller.js";

const router = Router();

router.post("/session", createSessionController);

router.get("/admin/me", verifyFirebaseToken, getAdminMeController);

router.post("/register/email", registerEmailUserController);

router.post("/register/availability", checkRegisterAvailabilityController);

router.post("/check-login-method", checkLoginMethodController);

export default router;