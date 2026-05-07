import resubmitReturnedPlaceSubmissionService from "../../../services/submissions/update/resubmitReturnedPlaceSubmission.service.js";

export default async function resubmitReturnedPlaceSubmissionController(req, res) {
  try {
    const { submissionId } = req.params;
    const uid = req.user?.uid;

    const result = await resubmitReturnedPlaceSubmissionService({
      submissionId,
      uid,
      payload: req.body,
    });

    return res.status(200).json({
      ok: true,
      message: "Propuesta reenviada correctamente.",
      data: result,
    });
  } catch (error) {
    console.log("Error en resubmitReturnedPlaceSubmissionController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error al reenviar la propuesta.",
    });
  }
}