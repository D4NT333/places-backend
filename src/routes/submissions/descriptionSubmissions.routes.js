import { Router } from "express";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";
import createDescriptionSubmissionController from "../../controllers/submissions/description/create/createDescriptionSubmission.controller.js";
import getDescriptionSubmissionsController from "../../controllers/submissions/description/read/getDescriptionSubmissions.controller.js";
import getDescriptionSubmissionDetailController from "../../controllers/submissions/description/read/getDescriptionSubmissionDetail.controller.js";
import getMyDescriptionSubmissionsController from "../../controllers/submissions/description/read/getMyDescriptionSubmissions.controller.js";
import getMyDescriptionSubmissionDetailController from "../../controllers/submissions/description/read/getMyDescriptionSubmissionDetail.controller.js";
import approveDescriptionSubmissionController from "../../controllers/submissions/description/update/approveDescriptionSubmission.controller.js";
import rejectDescriptionSubmissionController from "../../controllers/submissions/description/update/rejectDescriptionSubmission.controller.js";

const router = Router();

router.post("/places/:placeId/description-submissions",verifyFirebaseToken,createDescriptionSubmissionController);

router.get("/description-submissions",verifyFirebaseToken,getDescriptionSubmissionsController);

router.get("/description-submissions/me",verifyFirebaseToken,getMyDescriptionSubmissionsController);

router.get("/description-submissions/me/:submissionId",verifyFirebaseToken,getMyDescriptionSubmissionDetailController);

router.get("/description-submissions/:submissionId",verifyFirebaseToken,getDescriptionSubmissionDetailController);

router.patch("/description-submissions/:submissionId/approve",verifyFirebaseToken,approveDescriptionSubmissionController);

router.patch("/description-submissions/:submissionId/reject",verifyFirebaseToken,rejectDescriptionSubmissionController);

export default router;