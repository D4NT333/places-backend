import getSubmissionDetailService from "../../../services/submissions/read/getSubmissionDetail.service.js";

export default async function getSubmissionDetailController(req, res) {
  try {
    const { submissionId } = req.params;

    console.log("========== GET /admin/place-submissions/:submissionId ==========");
    console.log("Params recibidos:", req.params);

    const result = await getSubmissionDetailService({ submissionId });

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Error obteniendo detalle de submission:", error);

    return res.status(500).json({
      ok: false,
      message: error.message || "Error al obtener el detalle de la submission.",
    });
  }
}