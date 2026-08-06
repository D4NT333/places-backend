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
import updateAdminPlaceReviewVisibilityController from "../../controllers/places/updateAdminPlaceReviewVisibility.controller.js";
import getAdminPlaceLsearchGalleryController from "../../controllers/places/getAdminPlaceLsearchGallery.controller.js";
import getAdminPlaceAnalyticsController from "../../controllers/places/getAdminPlaceAnalytics.controller.js";
import getGoogleFeedPhotoController from "../../controllers/places/getGoogleFeedPhoto.controller.js";
import confirmPlaceActivityController from "../../controllers/places/interactions/confirmPlaceActivity.controller.js";
import resetPlacesActivityCheckpointsController from "../../controllers/places/activity/resetPlacesActivityCheckpoints.controller.js";

import getPlaceGalleryController from "../../controllers/places/getPlaceGallery.controller.js";
import getGoogleGalleryPhotoController from "../../controllers/places/getGoogleGalleryPhoto.controller.js";


import resolveAdminPlaceReportController from "../../controllers/places/resolveAdminPlaceReport.controller.js";
import moderateAdminPlaceController from "../../controllers/places/moderateAdminPlace.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";
import verifySuperAdmin from "../../middlewares/admins/verifySuperAdmin.js";
import verifyActiveAdmin from "../../middlewares/admins/verifyActiveAdmin.js";

import registerPlaceViewController from "../../controllers/places/interactions/registerPlaceView.controller.js";
import togglePlaceLikeController from "../../controllers/places/interactions/togglePlaceLike.controller.js";
import startPlaceDwellSessionController from "../../controllers/places/interactions/startPlaceDwellSession.controller.js";
import closePlaceDwellSessionController from "../../controllers/places/interactions/closePlaceDwellSession.controller.js";


import rejectGooglePlaceCandidateController from "../../controllers/places/update/rejectGooglePlaceCandidate.controller.js";

const router = Router();

/**
 * @route POST /places/add/discover-by-h3
 * @desc Descubre lugares usando un hex H3
 */

router.post("/admin/google-places/discover-by-h3", verifyFirebaseToken, verifySuperAdmin, discoverPlacesByH3Controller);

router.get("/admin/create-catalog", verifyFirebaseToken, verifyActiveAdmin, getCreateCatalogController);

router.get("/admin/google-places/candidates", verifyFirebaseToken, verifyActiveAdmin, listGooglePlaceCandidatesController);

router.get("/admin/google-places/candidates-summary", verifyFirebaseToken, verifyActiveAdmin, getGoogleCandidatesSummaryController);

router.get("/admin/google-places/candidates/:googlePlaceId/details", verifyFirebaseToken, verifyActiveAdmin, getGooglePlaceCandidateDetailsController);

router.post("/admin/google-places/register-from-candidate", verifyFirebaseToken, verifyActiveAdmin, registerPlaceFromCandidateController);

router.get("/feed", verifyFirebaseToken, getPlacesFeedController);

router.get("/photos/google", getGooglePlacePhotoController);

router.get("/feed-photo/google",getGoogleFeedPhotoController);

router.get("/:placeId/detail", verifyFirebaseToken, getPlaceDetailController);

router.post("/:placeId/route",verifyFirebaseToken,getPlaceRouteController);

router.get("/admin/list",verifyFirebaseToken,getAdminPlacesController);


router.get("/admin/:placeId",verifyFirebaseToken,getAdminPlaceDetailController);

router.get("/admin/:placeId/reviews",verifyFirebaseToken,getAdminPlaceReviewsController);

router.get("/admin/:placeId/reviews/:reviewId",verifyFirebaseToken,getAdminPlaceReviewDetailController,);

router.get("/admin/:placeId/reports",verifyFirebaseToken,getAdminPlaceReportsController);

router.get("/admin/:placeId/submissions",verifyFirebaseToken,getAdminPlaceSubmissionsController);

router.patch("/admin/:placeId/reviews/:reviewId/visibility",verifyFirebaseToken,updateAdminPlaceReviewVisibilityController);

router.get("/admin/:placeId/lsearch-gallery",verifyFirebaseToken,  getAdminPlaceLsearchGalleryController);

router.get("/gallery-photo/google",getGoogleGalleryPhotoController);

router.get("/:placeId/gallery",verifyFirebaseToken,getPlaceGalleryController);

router.get("/admin/:placeId/analytics",verifyFirebaseToken,getAdminPlaceAnalyticsController);


router.post("/:placeId/views",verifyFirebaseToken,registerPlaceViewController);

router.post("/:placeId/likes/toggle",verifyFirebaseToken,togglePlaceLikeController);

router.post("/:placeId/dwell-sessions",verifyFirebaseToken,startPlaceDwellSessionController);

router.patch("/:placeId/dwell-sessions/:sessionId/close",verifyFirebaseToken,closePlaceDwellSessionController);

router.post("/:placeId/activity-confirmation",verifyFirebaseToken,confirmPlaceActivityController);

router.patch("/admin/:placeId/reports/:reportId/resolve",verifyFirebaseToken,resolveAdminPlaceReportController);

router.patch("/admin/:placeId/moderation",verifyFirebaseToken,moderateAdminPlaceController);

router.post("/jobs/activity-checkpoints/reset",resetPlacesActivityCheckpointsController);


router.patch("/admin/google-places/candidates/:candidateId/reject",verifyFirebaseToken,verifyActiveAdmin,rejectGooglePlaceCandidateController,);


export default router;  

