import getPlacesFeedService from "../../services/places/read/getPlacesFeed.service.js";

export default async function getPlacesFeedController(req, res, next) {
  try {
    const { limit, cursor } = req.query;

    const result = await getPlacesFeedService({
      limit,
      cursor,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error en getPlacesFeedController:", error);
    return next(error);
  }
}