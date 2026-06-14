import { Router } from "express";

import createPhotoSubmissionController from "../../controllers/submissions/photo/create/createPhotoSubmission.controller.js";
import getPhotoSubmissionsController from "../../controllers/submissions/photo/read/getPhotoSubmissions.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

router.post("/places/:placeId/photo-submissions",verifyFirebaseToken,createPhotoSubmissionController);

router.get("/submissions/photo-submissions", verifyFirebaseToken,getPhotoSubmissionsController);

export default router;
