import getGooglePhotoUrlService from "../../../services/search/read/getGooglePhotoUrl.service.js";

export default async function getGooglePhotoUrlController(
  req,
  res
) {
  try {
    const result =
      await getGooglePhotoUrlService({
        reference:
          req.query.reference,

        maxWidthPx:
          req.query.maxWidthPx,
      });

    return res.status(200).json({
      message:
        "URL de fotografía obtenida correctamente.",

      photoUrl:
        result.photoUrl,

      reference:
        result.reference,

      maxWidthPx:
        result.maxWidthPx,

      fromCache:
        result.fromCache,
    });
  } catch (error) {
    console.error(
      "Error al obtener URL de fotografía de Google:",
      error
    );

    return res
      .status(
        error.statusCode || 500
      )
      .json({
        message:
          error.message ||
          "No se pudo obtener la fotografía de Google.",
      });
  }
}