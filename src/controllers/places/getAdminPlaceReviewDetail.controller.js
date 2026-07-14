import getAdminPlaceReviewDetailService from "../../services/places/read/getAdminPlaceReviewDetail.service.js";

export default async function getAdminPlaceReviewDetailController(
  req,
  res,
) {
  try {
    const {
      placeId,
      reviewId,
    } = req.params;

    const result =
      await getAdminPlaceReviewDetailService({
        placeId,
        reviewId,
      });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Error getting admin place review detail:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,

        message:
          error.message ||
          "No se pudo obtener el detalle de la reseña.",
      });
  }
}