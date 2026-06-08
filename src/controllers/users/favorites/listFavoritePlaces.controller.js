import listFavoritePlacesService from "../../../services/users/favorites/listFavoritePlaces.service.js";

export default async function listFavoritePlacesController(req, res, next) {
  try {
    const result = await listFavoritePlacesService({
      uid: req.user?.uid,
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en listFavoritePlacesController:", error);
    return next(error);
  }
}