import { Router } from "express";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

import listFavoritePlacesController from "../../controllers/users/favorites/listFavoritePlaces.controller.js";
import toggleFavoritePlaceController from "../../controllers/users/favorites/toggleFavoritePlace.controller.js";
import getCurrentUserController from "../../controllers/users/getCurrentUser.controller.js";

import getAdminUsersController from "../../controllers/users/read/getAdminUsers.controller.js";
import getAdminUserDetailController from "../../controllers/users/read/getAdminUserDetail.controller.js";
import getAdminUserHistoryController from "../../controllers/users/read/getAdminUserHistory.controller.js";
import getAdminUserReportsController from "../../controllers/users/read/getAdminUserReports.controller.js";

const router = Router();

router.get("/me", verifyFirebaseToken, getCurrentUserController);

router.get("/me/favorites",verifyFirebaseToken,listFavoritePlacesController);

router.post("/me/favorites/:placeId/toggle",verifyFirebaseToken,toggleFavoritePlaceController);

router.get("/admin/list",verifyFirebaseToken,getAdminUsersController);

router.get("/admin/detail/:userId",verifyFirebaseToken,getAdminUserDetailController);

router.get("/admin/detail/:userId/history",verifyFirebaseToken,getAdminUserHistoryController);

router.get("/admin/detail/:userId/reports",verifyFirebaseToken,getAdminUserReportsController);

export default router;