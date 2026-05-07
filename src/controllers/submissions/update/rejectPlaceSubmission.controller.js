import rejectPlaceSubmissionService from "../../../services/submissions/update/rejectPlaceSubmission.service.js";

export default async function rejectPlaceSubmissionController(req, res) {
  try {
    const { submissionId } = req.params;

    const rejectedBy =
      req.user?.uid ||
      req.user?.email ||
      req.admin?.uid ||
      null;

    const data = await rejectPlaceSubmissionService({
      submissionId,
      payload: req.body,
      rejectedBy,
    });

    return res.status(200).json({
      ok: true,
      message: "Propuesta rechazada correctamente.",
      data,
    });
  } catch (error) {
    console.error("Error en rejectPlaceSubmissionController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudo rechazar la propuesta.",
    });
  }
}