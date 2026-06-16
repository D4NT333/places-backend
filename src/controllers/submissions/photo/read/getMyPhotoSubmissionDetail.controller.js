import getMyPhotoSubmissionDetailService from "../../../../services/submissions/photo/read/getMyPhotoSubmissionDetail.service.js";

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export default async function getMyPhotoSubmissionDetailController(
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

    if (!userId) {
      return res.status(401).json({
        message:
          "No se encontró un usuario autenticado.",
      });
    }

    if (!submissionId) {
      return res.status(400).json({
        message:
          "Falta el identificador de la propuesta.",
      });
    }

    const submission =
      await getMyPhotoSubmissionDetailService({
        submissionId,
        userId,
      });

    return res.status(200).json({
      submission,
    });
  } catch (error) {
    console.error(
      "Error obteniendo el detalle de la propuesta de fotografías:",
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
            ? "No se pudo obtener el detalle de la propuesta de fotografías."
            : error.message,
      });
  }
}