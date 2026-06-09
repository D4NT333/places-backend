import getReturnedPlaceSubmissionReviewService from "../../../../services/submissions/place/read/getReturnedPlaceSubmissionReview.service.js";

export default async function getReturnedPlaceSubmissionReviewController(
  req,
  res
) {
  try {
    const { submissionId } = req.params;

    const data = await getReturnedPlaceSubmissionReviewService(submissionId);

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    console.log("Error en getReturnedPlaceSubmissionReviewController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.message || "No se pudo cargar la información de devolución.",
    });
  }
}