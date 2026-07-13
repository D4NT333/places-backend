import getAdminPlaceDetailService from "../../services/places/read/getAdminPlaceDetail.service.js";

export default async function getAdminPlaceDetailController(
  req,
  res,
) {
  try {
    const { placeId } = req.params;

    const result =
      await getAdminPlaceDetailService(placeId);

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Error getting admin place detail:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,
        message:
          error.message ||
          "No se pudo obtener el detalle del lugar.",
      });
  }
}