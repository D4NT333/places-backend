import rejectDescriptionSubmissionService from "../../../../services/submissions/description/update/rejectDescriptionSubmission.service.js";

export default async function rejectDescriptionSubmissionController(req, res, next) {
  try {
    const { submissionId } = req.params;

    const result = await rejectDescriptionSubmissionService({
      submissionId,
      payload: req.body,
      rejectedBy: req.user?.uid || null,
    });

    return res.status(200).json({
      message: "Propuesta de descripción rechazada correctamente.",
      submission: result,
    });
  } catch (error) {
    next(error);
  }
}