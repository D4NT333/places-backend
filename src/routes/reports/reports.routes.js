import { Router } from "express";

import verifyFirebaseToken from "../../middlewares/submissions/verifyFirebaseToken.js";
import createReportController from "../../controllers/reports/create/createReport.controller.js";
import getReportsController from "../../controllers/reports/read/getReports.controller.js";

const router = Router();

router.post("/", verifyFirebaseToken, createReportController);

router.get("/list", verifyFirebaseToken, getReportsController);

export default router;