import togglePlaceLikeService from "../../../services/places/create/interactions/togglePlaceLike.service.js";

export default async function togglePlaceLikeController(
  req,
  res,
) {
  try {
    const { placeId } = req.params;

    const uid =
      req.user?.uid ??
      req.firebaseUser?.uid;

    const result =
      await togglePlaceLikeService({
        placeId,
        uid,
      });

    console.info(
      result.liked
        ? "[PLACE_LIKE_ADDED]"
        : "[PLACE_LIKE_REMOVED]",
      {
        placeId,
        uid,

        likesCount: result.likesCount,

        weekId: result.weekId,
        dayId: result.dayId,
      },
    );

    return res.status(200).json({
      ok: true,

      like: {
        liked: result.liked,
        likesCount: result.likesCount,
      },
    });
  } catch (error) {
    console.error(
      "[TOGGLE_PLACE_LIKE_ERROR]",
      {
        placeId: req.params?.placeId,

        uid:
          req.user?.uid ??
          req.firebaseUser?.uid ??
          null,

        message: error.message,
        stack: error.stack,
      },
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,

        message:
          error.statusCode
            ? error.message
            : "No se pudo actualizar el Me gusta.",
      });
  }
}