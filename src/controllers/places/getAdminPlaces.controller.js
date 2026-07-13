import getAdminPlacesService from "../../services/places/read/getAdminPlaces.service.js";

export default async function getAdminPlacesController(req, res) {
  try {
    const result = await getAdminPlacesService({
      limit: req.query.limit,
      cursor: req.query.cursor || null,
      moderationStatus:
        req.query.moderationStatus || "all",
      activityStatus:
        req.query.activityStatus || "all",
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Error obteniendo lugares administrativos:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.message ||
        "No se pudieron obtener los lugares.",
    });
  }
}