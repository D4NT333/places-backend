import { Router } from "express";
import { getNearbyFeedController } from "../../controllers/feed/getNearbyFeed.controller.js";

const router = Router();

router.post("/location", getNearbyFeedController);


export default router;