import getReportsService from "../../../services/reports/read/getReports.service.js";

export default async function getReportsController(req, res) {
  try {
    const result = await getReportsService({
      user: req.user,
      query: req.query,
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Error getting reports:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudieron obtener los reportes.",
    });
  }
}