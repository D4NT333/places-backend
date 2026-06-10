import approveDescriptionSubmissionService from "../../../../services/submissions/description/update/approveDescriptionSubmission.service.js";

async function approveDescriptionSubmissionController(req, res) {
  try {
    const { submissionId } = req.params;

    const result = await approveDescriptionSubmissionService({
      submissionId,
      reviewedBy: req.user,
    });

    return res.status(200).json({
      ok: true,
      message: "Propuesta de descripción aprobada correctamente.",
      result,
    });
  } catch (error) {
    console.log("Error en approveDescriptionSubmissionController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.message ||
        "No se pudo aprobar la propuesta de descripción.",
    });
  }
}

export default approveDescriptionSubmissionController;