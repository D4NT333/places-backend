import getMyPlaceSubmissionDetailService from "../../../../services/submissions/place/read/getMyPlaceSubmissionDetail.service.js";

export default async function getMyPlaceSubmissionDetailController(req, res) {
  try {
    const uid = req.user?.uid;
    const { submissionId } = req.params;

    const submission = await getMyPlaceSubmissionDetailService({
      uid,
      submissionId,
    });

    if (!submission) {
      return res.status(404).json({
        ok: false,
        message: "Propuesta no encontrada.",
      });
    }

    return res.status(200).json({
      ok: true,
      data: submission,
    });
  } catch (error) {
    console.error("Error al obtener detalle de propuesta:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.statusCode === 403
          ? "No tienes permiso para ver esta propuesta."
          : "Error al obtener detalle de propuesta.",
    });
  }
}