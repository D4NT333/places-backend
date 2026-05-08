import { Router } from "express";
import createPlaceSubmissionController from "../../controllers/submissions/create/createPlaceSubmission.controller.js";
import listPlaceSubmissionsController from "../../controllers/submissions/read/listPlaceSubmissions.controller.js";
import getSubmissionDetailController from "../../controllers/submissions/read/getSubmissionDetail.controller.js";
import getMyPlaceSubmissionsController from "../../controllers/submissions/read/getMyPlaceSubmissions.controller.js";
import getMyPlaceSubmissionDetailController from "../../controllers/submissions/read/getMyPlaceSubmissionDetail.controller.js";
import returnPlaceSubmissionController from "../../controllers/submissions/create/returnPlaceSubmission.controller.js";
import getReturnedPlaceSubmissionEditDataController from "../../controllers/submissions/read/getReturnedPlaceSubmissionEditData.controller.js";
import resubmitReturnedPlaceSubmissionController from "../../controllers/submissions/update/resubmitReturnedPlaceSubmission.controller.js";
import getReturnedPlaceSubmissionReviewController from "../../controllers/submissions/read/getReturnedPlaceSubmissionReview.controller.js";
import rejectPlaceSubmissionController from "../../controllers/submissions/update/rejectPlaceSubmission.controller.js";
import getMyRejectedPlaceSubmissionReasonController from "../../controllers/submissions/read/getMyRejectedPlaceSubmissionReason.controller.js";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";

const router = Router();

router.post("/place-submissions", createPlaceSubmissionController);

router.get("/admin/place-submissions", listPlaceSubmissionsController);

router.get("/admin/place-submissions/:submissionId",getSubmissionDetailController);

router.get("/place-submissions/my-places",verifyFirebaseToken,getMyPlaceSubmissionsController);

router.get("/place-submissions/my-places/:submissionId",verifyFirebaseToken,getMyPlaceSubmissionDetailController);

router.post("/admin/place-submissions/:submissionId/return", returnPlaceSubmissionController);

router.get("/place-submissions/my-places/returned/:submissionId/edit",verifyFirebaseToken,getReturnedPlaceSubmissionEditDataController);

router.patch("/place-submissions/my-places/returned/:submissionId/resubmit",verifyFirebaseToken,resubmitReturnedPlaceSubmissionController);

router.get("/admin/place-submissions/:submissionId/return",getReturnedPlaceSubmissionReviewController);

router.post("/admin/place-submissions/:submissionId/reject",rejectPlaceSubmissionController);

router.get("/place-submissions/my-places/:submissionId/rejection",verifyFirebaseToken,getMyRejectedPlaceSubmissionReasonController);

export default router;