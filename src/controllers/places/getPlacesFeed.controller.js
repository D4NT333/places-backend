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

    const result =
      await getPlacesFeedService({
        latitude,
        longitude,
        limit,
        cursor,
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