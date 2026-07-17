import getAdminPlaceLsearchGalleryService from "../../services/places/read/getAdminPlaceLsearchGallery.service.js";

export default async function getAdminPlaceLsearchGalleryController(
  req,
  res
) {
  try {
    const { placeId } = req.params;

    const gallery =
      await getAdminPlaceLsearchGalleryService({
        placeId,
      });

    return res.status(200).json({
      ok: true,
      gallery,
    });
  } catch (error) {
    console.error(
      "Error obteniendo galería Lsearch del lugar:",
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,
        message:
          error.message ||
          "No se pudo obtener la galería del lugar.",
      });
  }
}