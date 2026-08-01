function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeGooglePhotoReference(
  value,
) {
  const reference =
    cleanText(value).replace(
      /\/media$/,
      "",
    );

  if (!reference) {
    return "";
  }

  if (
    !reference.startsWith(
      "places/",
    ) ||
    !reference.includes(
      "/photos/",
    )
  ) {
    return "";
  }

  return reference;
}

export default async function getGoogleGalleryPhotoController(
  req,
  res,
  next,
) {
  try {
    const reference =
      normalizeGooglePhotoReference(
        req.query.reference,
      );

    if (!reference) {
      return res.status(400).json({
        message:
          "La referencia de la fotografía no es válida.",
      });
    }

    const apiKey =
      process.env
        .GOOGLE_PLACES_API_KEY ||
      process.env
        .GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        message:
          "No está configurada la API key de Google Places.",
      });
    }

    /*
     * Resolución grande y razonable para
     * la galería móvil.
     */
    const maxWidthPx =
      2400;

    const googlePhotoUrl =
      new URL(
        `https://places.googleapis.com/v1/${reference}/media`,
      );

    googlePhotoUrl.searchParams.set(
      "maxWidthPx",
      String(maxWidthPx),
    );

    googlePhotoUrl.searchParams.set(
      "skipHttpRedirect",
      "true",
    );

    googlePhotoUrl.searchParams.set(
      "key",
      apiKey,
    );

    const googleResponse =
      await fetch(
        googlePhotoUrl,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },
        },
      );

    if (!googleResponse.ok) {
      const responseBody =
        await googleResponse.text();

      console.error(
        "Google rechazó la foto de galería:",
        {
          status:
            googleResponse.status,

          reference,

          responseBody,
        },
      );

      return res.status(502).json({
        message:
          "No fue posible obtener la fotografía de Google.",
      });
    }

    const googleData =
      await googleResponse.json();

    const photoUri =
      cleanText(
        googleData?.photoUri,
      );

    if (!photoUri) {
      return res.status(502).json({
        message:
          "Google no devolvió la URL de la fotografía.",
      });
    }

    /*
     * La referencia es estable, por lo que
     * permitimos caché.
     */
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );

    return res.redirect(
      302,
      photoUri,
    );
  } catch (error) {
    console.error(
      "Error en getGoogleGalleryPhotoController:",
      error,
    );

    return next(error);
  }
}