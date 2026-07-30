import { Router } from "express";
import createSessionController from "../../controllers/authentication/createSession.controller.js";
import getAdminMeController from "../../controllers/authentication/getAdminMe.controller.js";
import checkRegisterAvailabilityController from "../../controllers/authentication/checkRegisterAvailability.controller.js";
import getMobileMeController from "../../controllers/authentication/getMobileMe.controller.js";
import deleteMyAccountController from "../../controllers/authentication/deleteMyAccount.controller.js";

import getAdminsController from "../../controllers/authentication/getAdmins.controller.js";
import updateAdminRoleController from "../../controllers/authentication/update/updateAdminRole.controller.js"
import updateAdminStatusController from "../../controllers/authentication/update/updateAdminStatus.controller.js"

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

import verifySuperAdmin from "../../middlewares/admins/verifySuperAdmin.js";

import {registerEmailUserController} from "../../controllers/authentication/registerEmailUser.controller.js";


import { checkLoginMethodController } from "../../controllers/authentication/checkLoginMethod.controller.js";

const router = Router();

router.post("/session", createSessionController);

router.get("/admin/me", verifyFirebaseToken, getAdminMeController);

router.post("/register/email", registerEmailUserController);

router.post("/register/availability", checkRegisterAvailabilityController);

router.post("/check-login-method", checkLoginMethodController);

router.get("/me", verifyFirebaseToken, getMobileMeController);

router.delete("/me", verifyFirebaseToken, deleteMyAccountController);


router.get("/admins",verifyFirebaseToken,verifySuperAdmin,getAdminsController);

router.patch("/admins/:adminUid/role",verifyFirebaseToken,verifySuperAdmin,updateAdminRoleController);

router.patch("/admins/:adminUid/status",verifyFirebaseToken,verifySuperAdmin,updateAdminStatusController);

export default router;






