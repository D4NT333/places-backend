import createReportService from "../../../services/reports/create/createReport.service.js";

export default async function createReportController(req, res) {
  try {
    const result = await createReportService({
      user: req.user,
      payload: req.body,
    });

    return res.status(201).json({
      ok: true,
      report: result,
    });
  } catch (error) {
    console.error("Error creating report:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudo crear el reporte.",
    });
  }
}