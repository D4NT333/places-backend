import getMyDescriptionSubmissionDetailService from "../../../../services/submissions/description/read/getMyDescriptionSubmissionDetail.service.js";

async function getMyDescriptionSubmissionDetailController(req, res) {
  try {
    const userId = req.user?.uid;
    const { submissionId } = req.params;

    const submission = await getMyDescriptionSubmissionDetailService({
      userId,
      submissionId,
    });

    return res.status(200).json({
      ok: true,
      submission,
    });
  } catch (error) {
    console.log("Error en getMyDescriptionSubmissionDetailController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.message ||
        "No se pudo cargar el detalle de la propuesta de descripción.",
    });
  }
}

export default getMyDescriptionSubmissionDetailController;