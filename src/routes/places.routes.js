import { Router } from "express";
import { searchNearby } from "../controllers/places.controller.js";

const router = Router();

router.get("/searchNearby", searchNearby);

export default router;
