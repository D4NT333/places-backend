import getAdminPlaceReviewsService from "../../services/places/read/getAdminPlaceReviews.service.js";

export default async function getAdminPlaceReviewsController(
  req,
  res,
) {
  try {
    const { placeId } = req.params;

    const {
      limit = 10,
      cursor = null,
    } = req.query;

    const result =
      await getAdminPlaceReviewsService({
        placeId,
        limit,
        cursor,
      });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Error getting admin place reviews:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,
        message:
          error.message ||
          "No se pudieron obtener las reseñas del lugar.",
      });
  }
}