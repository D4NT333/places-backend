import getDescriptionSubmissionRejectionReasonService from "../../../../services/submissions/description/read/getDescriptionSubmissionRejectionReason.service.js";

export default async function getDescriptionSubmissionRejectionReasonController(
  req,
  res,
  next
) {
  try {
    const { submissionId } = req.params;

    const result = await getDescriptionSubmissionRejectionReasonService({
      submissionId,
      userId: req.user?.uid || null,
    });

    return res.status(200).json({
      rejectionReason: result,
    });
  } catch (error) {
    next(error);
  }
}