import approvePlaceSubmissionService from "../../../../services/submissions/place/update/approveSubmission.service.js";

export default async function approvePlaceSubmissionController(req, res, next) {
  try {
    const { submissionId } = req.params;

    const result = await approvePlaceSubmissionService({
      submissionId,
      approvedBy: req.user?.uid || "admin_panel",
    });

    return res.status(200).json({
      message: "Propuesta aprobada y lugar publicado correctamente.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}