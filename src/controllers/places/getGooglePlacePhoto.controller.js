export default async function getGooglePlacePhotoController(req, res, next) {
  try {
    const reference =
      typeof req.query.reference === "string"
        ? req.query.reference.trim()
        : "";

    if (!reference) {
      return res.status(400).json({
        message: "La referencia de la foto es obligatoria.",
      });
    }

    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        message: "No está configurada la API key de Google Places.",
      });
    }

    const googlePhotoUrl = new URL(
      `https://places.googleapis.com/v1/${reference}/media`
    );

    googlePhotoUrl.searchParams.set("maxWidthPx", "1200");
    googlePhotoUrl.searchParams.set("key", apiKey);

    return res.redirect(googlePhotoUrl.toString());
  } catch (error) {
    console.error("Error en getGooglePlacePhotoController:", error);
    return next(error);
  }
}