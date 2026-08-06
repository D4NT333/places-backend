import getPlacesFeedService from "../../services/places/read/getPlacesFeed.service.js";

export default async function getPlacesFeedController(
  req,
  res,
  next,
) {
  try {
    const {
      latitude,
      longitude,
      limit,
      cursor,
    } = req.query;

    const uid =
      typeof req.user?.uid === "string"
        ? req.user.uid.trim()
        : "";

    if (!uid) {
      const error = new Error(
        "El usuario autenticado es obligatorio para generar el feed.",
      );

      error.statusCode = 401;

      throw error;
    }

    const result =
      await getPlacesFeedService({
        latitude,
        longitude,
        limit,
        cursor,
        uid,
      });

    return res
      .status(200)
      .json(result);
  } catch (error) {
    console.error(
      "Error en getPlacesFeedController:",
      error,
    );

    return next(error);
  }
}