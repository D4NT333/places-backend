import rejectPhotoSubmissionService from "../../../../services/submissions/photo/update/rejectPhotoSubmission.service.js";

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export default async function rejectPhotoSubmissionController(
  req,
  res
) {
  try {
    const rejectedBy =
      cleanString(req.user?.uid);

    const submissionId =
      cleanString(
        req.params?.submissionId
      );

    const reason =
      cleanString(
        req.body?.reason
      );

    const message =
      cleanString(
        req.body?.message
      );

    const submission =
      await rejectPhotoSubmissionService({
        submissionId,
        rejectedBy,
        reason,
        message,
      });

    return res.status(200).json({
      message:
        "Propuesta de fotografías rechazada correctamente.",

      submission,
    });
  } catch (error) {
    console.error(
      "Error rechazando propuesta de fotografías:",
      error
    );

    const statusCode =
      Number.isInteger(
        error?.statusCode
      )
        ? error.statusCode
        : 500;

    return res
      .status(statusCode)
      .json({
        message:
          statusCode === 500
            ? "No se pudo rechazar la propuesta de fotografías."
            : error.message,
      });
  }
}