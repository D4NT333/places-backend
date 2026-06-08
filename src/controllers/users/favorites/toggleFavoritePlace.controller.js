import toggleFavoritePlaceService from "../../../services/users/favorites/toggleFavoritePlace.service.js";

export default async function toggleFavoritePlaceController(req, res, next) {
  try {
    const { placeId } = req.params;

    const result = await toggleFavoritePlaceService({
      uid: req.user?.uid,
      placeId,
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en toggleFavoritePlaceController:", error);
    return next(error);
  }
}