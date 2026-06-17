import { Router } from "express";

import getGooglePhotoUrlController from "../../controllers/search/read/getGooglePhotoUrl.controller.js";

const router = Router();

router.get("/google",getGooglePhotoUrlController);

export default router;