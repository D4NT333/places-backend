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

router.post("/admin/google-places/register-from-candidate",registerPlaceFromCandidateController);

router.get("/feed", getPlacesFeedController);

router.get("/photos/google", getGooglePlacePhotoController);

router.get("/:placeId/detail", getPlaceDetailController);

export default router;  