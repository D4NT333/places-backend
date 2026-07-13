import getAdminPlaceReportsService from "../../services/places/read/getAdminPlaceReports.service.js";

export default async function getAdminPlaceReportsController(
  req,
  res,
) {
  try {
    const { placeId } = req.params;

    const {
      limit = 10,
      cursor = null,
      status = "all",
    } = req.query;

    const result =
      await getAdminPlaceReportsService({
        placeId,
        limit,
        cursor,
        status,
      });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Error getting admin place reports:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,
        message:
          error.message ||
          "No se pudieron obtener los reportes del lugar.",
      });
  }
}