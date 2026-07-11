import getAdminUserReportDetailService from "../../../services/users/read/getAdminUserReportDetail.service.js";

export default async function getAdminUserReportDetailController(
  req,
  res
) {
  try {
    const { userId, reportId } = req.params;

    const result =
      await getAdminUserReportDetailService({
        userId,
        reportId,
      });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Error getting admin user report detail:",
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        message:
          error.message ||
          "No se pudo obtener el detalle del reporte.",
      });
  }
}