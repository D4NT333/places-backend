import getAdminUserReportsService from "../../../services/users/read/getAdminUserReports.service.js";

export default async function getAdminUserReportsController(req, res) {
  try {
    const { userId } = req.params;

    const limit = Number(req.query.limit) || 15;
    const cursor = req.query.cursor || null;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: "Falta el id del usuario.",
      });
    }

    const result = await getAdminUserReportsService({
      userId,
      limit,
      cursor,
    });

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Error getting admin user reports:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudieron obtener los reportes del usuario.",
      error: error.message,
    });
  }
}