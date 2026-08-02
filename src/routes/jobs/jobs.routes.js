import { Router } from "express";

import runPlacesActivityStatusJobController from "../../controllers/places/activity/runPlacesActivityStatusJob.controller.js";
import resetPlacesActivityCheckpointsController from "../../controllers/places/activity/resetPlacesActivityCheckpoints.controller.js";

const router = Router();

router.post("/places/activity-status",runPlacesActivityStatusJobController);

router.post("/places/activity-checkpoints",resetPlacesActivityCheckpointsController);

export default router;