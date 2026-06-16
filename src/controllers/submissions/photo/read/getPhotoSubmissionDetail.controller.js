import getPhotoSubmissionDetailService from "../../../../services/submissions/photo/read/getPhotoSubmissionDetail.service.js";

export default async function getPhotoSubmissionDetailController(
  req,
  res,
  next
) {
  try {
    const {
      submissionId,
    } = req.params;

    const submission =
      await getPhotoSubmissionDetailService(
        submissionId
      );

    return res.status(200).json({
      message:
        "Detalle de la propuesta obtenido correctamente.",

      submission,
    });
  } catch (error) {
    console.error(
      "Error obteniendo detalle de propuesta de fotografías:",
      error
    );

    return next(error);
  }
}