import getPlaceReviewDetailService from "../../services/reviews/read/getPlaceReviewDetail.service.js";

export default async function getPlaceReviewDetailController(req, res) {
  try {
    const { placeId, reviewId } = req.params;

    const review = await getPlaceReviewDetailService({
      placeId,
      reviewId,
    });

    return res.status(200).json({
      ok: true,
      review,
    });
  } catch (error) {
    console.error("Error getting place review detail:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error al obtener el detalle de la reseña.",
    });
  }
}