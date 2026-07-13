import getAdminPlaceSubmissionsService from "../../services/places/read/getAdminPlaceSubmissions.service.js";

export default async function getAdminPlaceSubmissionsController(
  req,
  res,
) {
  try {
    const { placeId } = req.params;

    const {
      limit = 10,
      cursor = null,
      type = "all",
    } = req.query;

    const result =
      await getAdminPlaceSubmissionsService({
        placeId,
        limit,
        cursor,
        type,
      });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Error getting admin place submissions:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,
        message:
          error.message ||
          "No se pudo obtener el historial de propuestas.",
      });
  }
}