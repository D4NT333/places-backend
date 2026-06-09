import getMyRejectedPlaceSubmissionReasonService from "../../../../services/submissions/place/read/getMyRejectedPlaceSubmissionReason.service.js";

export default async function getMyRejectedPlaceSubmissionReasonController(
  req,
  res
) {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.uid;

    const data = await getMyRejectedPlaceSubmissionReasonService({
      submissionId,
      userId,
    });

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error(
      "Error en getMyRejectedPlaceSubmissionReasonController:",
      error
    );

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.message || "No se pudo cargar el motivo de rechazo.",
    });
  }
}