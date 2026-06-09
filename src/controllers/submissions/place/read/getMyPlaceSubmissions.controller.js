import getMyPlaceSubmissionsService from "../../../../services/submissions/place/read/getMyPlaceSubmissions.service.js";

export default async function getMyPlaceSubmissionsController(req, res) {
  try {
    const uid = req.user?.uid;
    const { limit, cursor } = req.query;

    const result = await getMyPlaceSubmissionsService({
      uid,
      limit,
      cursor,
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Error al obtener propuestas del usuario:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener propuestas del usuario.",
    });
  }
}