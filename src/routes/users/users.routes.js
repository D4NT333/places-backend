import { Router } from "express";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

import listFavoritePlacesController from "../../controllers/users/favorites/listFavoritePlaces.controller.js";
import toggleFavoritePlaceController from "../../controllers/users/favorites/toggleFavoritePlace.controller.js";

const router = Router();

router.get("/me/favorites",verifyFirebaseToken,listFavoritePlacesController);

router.post("/me/favorites/:placeId/toggle",verifyFirebaseToken,toggleFavoritePlaceController);

export default router;