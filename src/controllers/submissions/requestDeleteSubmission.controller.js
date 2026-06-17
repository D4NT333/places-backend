import requestDeleteSubmissionService from "../../services/submissions/requestDeleteSubmission.service.js";

export default async function requestDeleteSubmissionController(req, res, next) {
  try {
    const { type, submissionId } = req.params;

    const result = await requestDeleteSubmissionService({
      type,
      submissionId,
      userId: req.user?.uid,
    });

    return res.status(200).json({
      ok: true,
      message: "Propuesta enviada a eliminación correctamente.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}