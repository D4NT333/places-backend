import getMyPhotoSubmissionRejectionReasonService from "../../../../services/submissions/photo/read/getMyPhotoSubmissionRejectionReason.service.js";

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export default async function getMyPhotoSubmissionRejectionReasonController(
  req,
  res
) {
  try {
    const userId =
      cleanString(req.user?.uid);

    const submissionId =
      cleanString(
        req.params?.submissionId
      );

    const rejection =
      await getMyPhotoSubmissionRejectionReasonService({
        submissionId,
        userId,
      });

    return res.status(200).json({
      rejection,
    });
  } catch (error) {
    console.error(
      "Error obteniendo el motivo de rechazo de fotografías:",
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
            ? "No se pudo obtener el motivo de rechazo."
            : error.message,
      });
  }
}