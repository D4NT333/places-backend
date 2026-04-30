import returnPlaceSubmissionService from "../../../services/submissions/create/returnPlaceSubmission.service.js";

export default async function returnPlaceSubmissionController(req, res) {
  try {
    const { submissionId } = req.params;
    const { generalMessage, fields } = req.body;

    const returnedBy = req.user?.uid || "admin_panel";

    const result = await returnPlaceSubmissionService({
      submissionId,
      returnedBy,
      generalMessage,
      fields,
    });

    return res.status(200).json({
      ok: true,
      message: "Propuesta devuelta correctamente.",
      data: result,
    });
  } catch (error) {
    console.error("Error al devolver propuesta:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error al devolver propuesta.",
    });
  }
}