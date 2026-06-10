import getDescriptionSubmissionDetailService from "../../../../services/submissions/description/read/getDescriptionSubmissionDetail.service.js";

async function getDescriptionSubmissionDetailController(req, res, next) {
  try {
    const { submissionId } = req.params;

    const submission = await getDescriptionSubmissionDetailService(submissionId);

    return res.status(200).json({
      ok: true,
      submission,
    });
  } catch (error) {
    console.error("Error en getDescriptionSubmissionDetailController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.message || "No se pudo cargar el detalle de la propuesta.",
    });
  }
}

export default getDescriptionSubmissionDetailController;