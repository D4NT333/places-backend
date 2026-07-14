import { Router } from "express";
import discoverPlacesByH3Controller from "../../controllers/places/discoverPlacesByH3.controller.js";
import getCreateCatalogController from "../../controllers/places/getCreateCatalog.controller.js";
import listGooglePlaceCandidatesController from "../../controllers/places/listGooglePlaceCandidates.controller.js";
import getGoogleCandidatesSummaryController from "../../controllers/places/getGoogleCandidatesSummary.controller.js";
import getGooglePlaceCandidateDetailsController from "../../controllers/places/getGooglePlaceCandidateDetails.controller.js";
import registerPlaceFromCandidateController from "../../controllers/places/registerPlaceFromCandidate.controller.js";
import getPlacesFeedController from "../../controllers/places/getPlacesFeed.controller.js";
import getPlaceDetailController from "../../controllers/places/getPlaceDetail.controller.js";
import getGooglePlacePhotoController from "../../controllers/places/getGooglePlacePhoto.controller.js";
import getPlaceRouteController from "../../controllers/routes/read/getPlaceRoute.controller.js";
import getAdminPlacesController from "../../controllers/places/getAdminPlaces.controller.js";
import getAdminPlaceDetailController from "../../controllers/places/getAdminPlaceDetail.controller.js";
import getAdminPlaceReviewsController from "../../controllers/places/getAdminPlaceReviews.controller.js";
import getAdminPlaceReportsController from "../../controllers/places/getAdminPlaceReports.controller.js";
import getAdminPlaceSubmissionsController from "../../controllers/places/getAdminPlaceSubmissions.controller.js";
import getAdminPlaceReviewDetailController from "../../controllers/places/getAdminPlaceReviewDetail.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

/**
 * @route POST /places/add/discover-by-h3
 * @desc Descubre lugares usando un hex H3
 */

router.post("/admin/google-places/discover-by-h3",discoverPlacesByH3Controller);
router.get("/admin/create-catalog", getCreateCatalogController);

router.get("/admin/google-places/candidates",listGooglePlaceCandidatesController);

router.get("/admin/google-places/candidates-summary",getGoogleCandidatesSummaryController);

router.get("/admin/google-places/candidates/:googlePlaceId/details",getGooglePlaceCandidateDetailsController);

router.post("/admin/google-places/register-from-candidate",verifyFirebaseToken,registerPlaceFromCandidateController);

router.get("/feed", getPlacesFeedController);

router.get("/photos/google", getGooglePlacePhotoController);

router.get("/:placeId/detail", verifyFirebaseToken, getPlaceDetailController);

router.post("/:placeId/route",verifyFirebaseToken,getPlaceRouteController);

router.get("/admin/list",verifyFirebaseToken,getAdminPlacesController);


router.get("/admin/:placeId",verifyFirebaseToken,getAdminPlaceDetailController);

router.get("/admin/:placeId/reviews",verifyFirebaseToken,getAdminPlaceReviewsController);

router.get("/admin/:placeId/reviews/:reviewId",verifyFirebaseToken,getAdminPlaceReviewDetailController,);

router.get("/admin/:placeId/reports",verifyFirebaseToken,getAdminPlaceReportsController);

router.get("/admin/:placeId/submissions",verifyFirebaseToken,getAdminPlaceSubmissionsController);


export default router;  

