import approvePhotoSubmissionService from "../../../../services/submissions/photo/update/approvePhotoSubmission.service.js";

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export default async function approvePhotoSubmissionController(
  req,
  res
) {
  try {
    const approvedBy =
      cleanString(req.user?.uid);

    const submissionId =
      cleanString(
        req.params?.submissionId
      );

    if (!approvedBy) {
      return res.status(401).json({
        message:
          "No se encontró un administrador autenticado.",
      });
    }

    if (!submissionId) {
      return res.status(400).json({
        message:
          "Falta el identificador de la propuesta.",
      });
    }

    const submission =
      await approvePhotoSubmissionService({
        submissionId,
        approvedBy,
      });

    return res.status(200).json({
      message:
        "Propuesta de fotografías aprobada correctamente.",

      submission,
    });
  } catch (error) {
    console.error(
      "Error aprobando propuesta de fotografías:",
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
            ? "No se pudo aprobar la propuesta de fotografías."
            : error.message,
      });
  }
}