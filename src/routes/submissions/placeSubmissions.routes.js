import { Router } from "express";
import createPlaceSubmissionController from "../../controllers/submissions/create/createPlaceSubmission.controller.js";
import listPlaceSubmissionsController from "../../controllers/submissions/read/listPlaceSubmissions.controller.js";

const router = Router();

router.post("/place-submissions", createPlaceSubmissionController);

router.get("/admin/place-submissions", listPlaceSubmissionsController);

export default router;