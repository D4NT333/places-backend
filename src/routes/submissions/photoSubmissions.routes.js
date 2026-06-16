import { Router } from "express";

import createPhotoSubmissionController from "../../controllers/submissions/photo/create/createPhotoSubmission.controller.js";
import getPhotoSubmissionsController from "../../controllers/submissions/photo/read/getPhotoSubmissions.controller.js";
import getMyPhotoSubmissionsController from "../../controllers/submissions/photo/read/getMyPhotoSubmissions.controller.js";
import getMyPhotoSubmissionDetailController from "../../controllers/submissions/photo/read/getMyPhotoSubmissionDetail.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

router.post("/places/:placeId/photo-submissions",verifyFirebaseToken,createPhotoSubmissionController);

router.get("/submissions/photo-submissions", verifyFirebaseToken,getPhotoSubmissionsController);

router.get("/photo-submissions/my",verifyFirebaseToken,getMyPhotoSubmissionsController);

router.get("/photo-submissions/my/:submissionId",verifyFirebaseToken,getMyPhotoSubmissionDetailController);

export default router;
