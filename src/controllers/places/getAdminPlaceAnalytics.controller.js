import getAdminPlaceAnalyticsService from "../../services/places/read/getAdminPlaceAnalytics.service.js";

export default async function getAdminPlaceAnalyticsController(
  req,
  res,
  next,
) {
  try {
    const {
      placeId,
    } = req.params;

    const {
      weekId,
    } = req.query;

    const result =
      await getAdminPlaceAnalyticsService({
        placeId,
        weekId,
      });

    return res
      .status(200)
      .json({
        ok: true,
        analytics: result,
      });
  } catch (error) {
    console.error(
      "Error en getAdminPlaceAnalyticsController:",
      {
        placeId:
          req.params?.placeId,

        weekId:
          req.query?.weekId,

        uid:
          req.user?.uid ||
          null,

        message:
          error.message,

        stack:
          error.stack,
      },
    );

    return next(error);
  }
}