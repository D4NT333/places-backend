import { Router } from "express";
import discoverPlacesByH3Controller from "../../controllers/places/discoverPlacesByH3.controller.js";
import getCreateCatalogController from "../../controllers/places/getCreateCatalog.controller.js";
import listGooglePlaceCandidatesController from "../../controllers/places/listGooglePlaceCandidates.controller.js";
import getGoogleCandidatesSummaryController from "../../controllers/places/getGoogleCandidatesSummary.controller.js";
import getGooglePlaceCandidateDetailsController from "../../controllers/places/getGooglePlaceCandidateDetails.controller.js";

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

export default router;  