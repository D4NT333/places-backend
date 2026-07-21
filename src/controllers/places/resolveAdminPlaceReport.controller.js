import resolveAdminPlaceReportService from "../../services/places/update/resolveAdminPlaceReport.service.js";

export default async function resolveAdminPlaceReportController(
  req,
  res,
  next
) {
  try {
    const {
      placeId,
      reportId,
    } = req.params;

    const {
      decision,
      resolutionNote,
    } = req.body;

    const result =
      await resolveAdminPlaceReportService({
        adminUid:
          req.user?.uid,

        placeId,
        reportId,
        decision,
        resolutionNote,
      });

    return res.status(200).json({
      ok: true,
      message:
        decision === "resolved"
          ? "El reporte fue validado correctamente."
          : "El reporte fue descartado correctamente.",

      ...result,
    });
  } catch (error) {
    console.error(
      "Error en resolveAdminPlaceReportController:",
      error
    );

    return next(error);
  }
}