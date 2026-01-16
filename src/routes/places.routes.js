import { Router } from "express";
import { getPlaces } from "../controllers/places.controller.js";

const router = Router();

router.get("/places", getPlaces);

export default router;
