import listPlaceSubmissionsService from "../../../../services/submissions/place/read/listPlaceSubmissions.service.js";

export default async function listPlaceSubmissionsController(req, res) {
  try {
    console.log("========== GET /admin/place-submissions ==========");
    console.log("Query recibida:", req.query);

    const { status = "all", limit = 15, cursor = null } = req.query;

    const result = await listPlaceSubmissionsService({
      status,
      limit,
      cursor,
    });

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Error listando submissions de lugares:", error);

    return res.status(500).json({
      ok: false,
      message: error.message || "Error al listar submissions de lugares.",
    });
  }
}