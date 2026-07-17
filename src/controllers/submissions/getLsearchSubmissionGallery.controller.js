import getLsearchSubmissionGalleryService from "../../services/submissions/getLsearchSubmissionGallery.service.js";

export default async function getLsearchSubmissionGalleryController(
  req,
  res
) {
  try {
    const {
      submissionType,
      submissionId,
    } = req.params;

    const gallery =
      await getLsearchSubmissionGalleryService({
        submissionType,
        submissionId,
      });

    return res.status(200).json({
      ok: true,
      gallery,
    });
  } catch (error) {
    console.error(
      "Error obteniendo galería de propuesta:",
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,
        message:
          error.message ||
          "No se pudieron obtener las fotografías originales.",
      });
  }
}