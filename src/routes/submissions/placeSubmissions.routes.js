import { Router } from "express";
import createPlaceSubmissionController from "../../controllers/submissions/create/createPlaceSubmission.controller.js";
import listPlaceSubmissionsController from "../../controllers/submissions/read/listPlaceSubmissions.controller.js";
import getSubmissionDetailController from "../../controllers/submissions/read/getSubmissionDetail.controller.js";

const router = Router();

router.post("/place-submissions", createPlaceSubmissionController);

router.get("/admin/place-submissions", listPlaceSubmissionsController);

router.get("/admin/place-submissions/:submissionId",getSubmissionDetailController);

export default router;