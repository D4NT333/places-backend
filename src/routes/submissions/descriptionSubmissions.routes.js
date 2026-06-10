import { Router } from "express";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";
import createDescriptionSubmissionController from "../../controllers/submissions/description/create/createDescriptionSubmission.controller.js";
import getDescriptionSubmissionsController from "../../controllers/submissions/description/read/getDescriptionSubmissions.controller.js";
import getDescriptionSubmissionDetailController from "../../controllers/submissions/description/read/getDescriptionSubmissionDetail.controller.js";
import getMyDescriptionSubmissionsController from "../../controllers/submissions/description/read/getMyDescriptionSubmissions.controller.js";

const router = Router();

router.post("/places/:placeId/description-submissions",verifyFirebaseToken,createDescriptionSubmissionController);

router.get("/description-submissions",verifyFirebaseToken,getDescriptionSubmissionsController);

router.get("/description-submissions/me",verifyFirebaseToken,getMyDescriptionSubmissionsController);

router.get("/description-submissions/:submissionId",verifyFirebaseToken,getDescriptionSubmissionDetailController);


export default router;