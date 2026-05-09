import { Router } from "express";
import discoverPlacesByH3Controller from "../../controllers/places/discoverPlacesByH3.controller.js";

const router = Router();

/**
 * @route POST /places/add/discover-by-h3
 * @desc Descubre lugares usando un hex H3
 */

router.post("/admin/google-places/discover-by-h3",discoverPlacesByH3Controller);

export default router;  