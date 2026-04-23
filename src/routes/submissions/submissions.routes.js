import { Router } from "express";
import createPlaceSubmissionController from "../../controllers/submissions/submissions.controller.js";

const router = Router();

router.post("/place-submissions", createPlaceSubmissionController);

export default router;