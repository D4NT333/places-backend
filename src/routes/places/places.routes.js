import { Router } from "express";
import { discoverPlacesByH3Controller } from "../../controllers/places/places.controller.js";

const router = Router();

/**
 * @route POST /places/add/discover-by-h3
 * @desc Descubre lugares usando un hex H3
 */
router.post("/discover-by-h3", discoverPlacesByH3Controller);

export default router;