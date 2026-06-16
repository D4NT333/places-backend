import { Router } from "express";

import createPhotoSubmissionController from "../../controllers/submissions/photo/create/createPhotoSubmission.controller.js";
import getPhotoSubmissionsController from "../../controllers/submissions/photo/read/getPhotoSubmissions.controller.js";
import getMyPhotoSubmissionsController from "../../controllers/submissions/photo/read/getMyPhotoSubmissions.controller.js";
import getMyPhotoSubmissionDetailController from "../../controllers/submissions/photo/read/getMyPhotoSubmissionDetail.controller.js";
import rejectPhotoSubmissionController from "../../controllers/submissions/photo/update/rejectPhotoSubmission.controller.js";
import getMyPhotoSubmissionRejectionReasonController from "../../controllers/submissions/photo/read/getMyPhotoSubmissionRejectionReason.controller.js";
import approvePhotoSubmissionController from "../../controllers/submissions/photo/update/approvePhotoSubmission.controller.js";
import getPhotoSubmissionDetailController from "../../controllers/submissions/photo/read/getPhotoSubmissionDetail.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

router.post("/places/:placeId/photo-submissions",verifyFirebaseToken,createPhotoSubmissionController);

router.get("/submissions/photo-submissions", verifyFirebaseToken,getPhotoSubmissionsController);

router.get("/photo-submissions/my",verifyFirebaseToken,getMyPhotoSubmissionsController);

router.get("/photo-submissions/my/:submissionId",verifyFirebaseToken,getMyPhotoSubmissionDetailController);

router.patch("/submissions/photo-submissions/:submissionId/reject",verifyFirebaseToken,rejectPhotoSubmissionController);

router.get("/photo-submissions/my/:submissionId/rejection-reason",verifyFirebaseToken,getMyPhotoSubmissionRejectionReasonController);

router.patch("/submissions/photo-submissions/:submissionId/approve",verifyFirebaseToken,approvePhotoSubmissionController);

router.get("/submissions/photo-submissions/:submissionId",verifyFirebaseToken,getPhotoSubmissionDetailController); 

export default router;
