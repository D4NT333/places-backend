import getMyDescriptionSubmissionsService from "../../../../services/submissions/description/read/getMyDescriptionSubmissions.service.js";

async function getMyDescriptionSubmissionsController(req, res) {
  try {
    const userId = req.user?.uid;
    const { limit } = req.query;

    const result = await getMyDescriptionSubmissionsService({
      userId,
      limit,
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Error en getMyDescriptionSubmissionsController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.message ||
        "No se pudieron cargar las propuestas de descripción.",
    });
  }
}

export default getMyDescriptionSubmissionsController;