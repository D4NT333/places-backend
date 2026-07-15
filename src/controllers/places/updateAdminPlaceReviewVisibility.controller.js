import updateAdminPlaceReviewVisibilityService from "../../services/places/update/updateAdminPlaceReviewVisibility.service.js";

export default async function updateAdminPlaceReviewVisibilityController(
  req,
  res,
) {
  try {
    const {
      placeId,
      reviewId,
    } = req.params;

    const {
      hidden,
      reason = "",
    } = req.body || {};

    const adminUid =
      req.user?.uid ||
      req.firebaseUser?.uid ||
      null;

    const result =
      await updateAdminPlaceReviewVisibilityService({
        placeId,
        reviewId,
        hidden,
        reason,
        adminUid,
      });

    let message = result.message;

    if (!message && result.changed) {
      message =
        result.status === "hidden"
          ? "La reseña fue ocultada correctamente."
          : "La reseña fue restaurada correctamente.";
    }

    return res.status(200).json({
      ok: true,
      message,
      ...result,
    });
  } catch (error) {
    console.error(
      "Error updating admin place review visibility:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,

        message:
          error.message ||
          "No se pudo actualizar la visibilidad de la reseña.",
      });
  }
}