import { Router } from "express";

import runPlacesActivityStatusJobController from "../../controllers/places/activity/runPlacesActivityStatusJob.controller.js";

const router = Router();

router.post("/places/activity-status",runPlacesActivityStatusJobController);

export default router;