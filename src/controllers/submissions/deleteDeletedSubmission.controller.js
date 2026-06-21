import deleteDeletedSubmissionService from "../../services/submissions/deleteDeletedSubmission.service.js";

export default async function deleteDeletedSubmissionController(
  req,
  res,
  next
) {
  try {
    const { deletedSubmissionId } =
      req.params;

    const result =
      await deleteDeletedSubmissionService({
        deletedSubmissionId,
      });

    return res.status(200).json({
      ok: true,
      message:
        "Propuesta eliminada definitivamente.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}