import { Router } from "express";
import createSessionController from "../../controllers/authentication/createSession.controller.js";

const router = Router();

router.post("/session", createSessionController);

export default router;