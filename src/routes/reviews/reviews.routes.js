import { Router } from "express";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

import createPlaceReviewController from "../../controllers/reviews/createPlaceReview.controller.js";
import getPlaceReviewDetailController from "../../controllers/reviews/getPlaceReviewDetail.controller.js";
import getPlaceReviewsController from "../../controllers/places/getPlaceReviews.controller.js"

const router = Router();

router.post("/places/:placeId",verifyFirebaseToken,createPlaceReviewController);

router.get("/places/:placeId/reviews",verifyFirebaseToken,getPlaceReviewsController);

router.get("/:placeId/reviews/:reviewId", verifyFirebaseToken, getPlaceReviewDetailController);

export default router;
