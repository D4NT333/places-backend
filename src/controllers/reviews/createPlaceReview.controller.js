import createPlaceReviewService from "../../services/reviews/create/createPlaceReview.service.js";

export default async function createPlaceReviewController(req, res, next) {
  try {
    const { placeId } = req.params;

    const result = await createPlaceReviewService({
      uid: req.user?.uid,
      user: req.user,
      placeId,
      body: req.body,
    });

    return res.status(201).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en createPlaceReviewController:", error);
    return next(error);
  }
}