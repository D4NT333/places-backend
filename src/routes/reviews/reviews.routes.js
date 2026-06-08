import { Router } from "express";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";
import createPlaceReviewController from "../../controllers/reviews/createPlaceReview.controller.js";

const router = Router();

router.post("/places/:placeId",verifyFirebaseToken,createPlaceReviewController);

export default router;