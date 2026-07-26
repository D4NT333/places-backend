import resolveAdminUserReportService from "../../../services/users/update/resolveAdminUserReport.service.js";

export default async function resolveAdminUserReportController(
  req,
  res,
) {
  try {
    const {
      userId,
      reportId,
    } = req.params;

    const {
      decision,
      resolutionNote,
    } = req.body;

    const result =
      await resolveAdminUserReportService({
        userId,
        reportId,

        decision,
        resolutionNote,

        adminUid:
          req.user?.uid,
      });

    return res
      .status(200)
      .json({
        message:
          result.decision ===
          "resolved"
            ? result.becameBanned
              ? "Reporte validado y usuario bloqueado."
              : "Reporte validado correctamente."
            : "Reporte descartado correctamente.",

        ...result,
      });
  } catch (error) {
    console.error(
      "Error resolving admin user report:",
      error,
    );

    return res
      .status(
        error.statusCode || 500,
      )
      .json({
        ok: false,

        message:
          error.message ||
          "No se pudo resolver el reporte.",
      });
  }
}