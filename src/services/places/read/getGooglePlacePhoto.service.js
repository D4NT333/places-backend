import googleConfig, {
  validateGoogleConfig,
} from "../../../config/google";

const ALLOWED_PHOTO_WIDTHS =
  new Set([
    240,
    1080,
  ]);

function createServiceError(
  message,
  statusCode,
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeMaxWidthPx(
  value,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    !ALLOWED_PHOTO_WIDTHS.has(
      parsed,
    )
  ) {
    return 1080;
  }

  return parsed;
}

function normalizePhotoReference(
  value,
) {
  const reference =
    cleanText(value);

  if (!reference) {
    throw createServiceError(
      "La referencia de la fotografía es obligatoria.",
      400,
    );
  }

  /*
   * Solo aceptamos referencias con la forma
   * entregada por Places API.
   */
  if (
    !reference.startsWith(
      "places/",
    ) ||
    !reference.includes(
      "/photos/",
    )
  ) {
    throw createServiceError(
      "La referencia de la fotografía no es válida.",
      400,
    );
  }

  return reference.replace(
    /\/media$/,
    "",
  );
}

export default async function getGooglePlacePhotoService({
  reference,
  maxWidthPx,
}) {
  validateGoogleConfig();

  const normalizedReference =
    normalizePhotoReference(
      reference,
    );

  const normalizedWidth =
    normalizeMaxWidthPx(
      maxWidthPx,
    );

  const googlePhotoUrl =
    new URL(
      `https://places.googleapis.com/v1/${normalizedReference}/media`,
    );

  googlePhotoUrl.searchParams.set(
    "maxWidthPx",
    String(normalizedWidth),
  );

  googlePhotoUrl.searchParams.set(
    "skipHttpRedirect",
    "true",
  );

  googlePhotoUrl.searchParams.set(
    "key",
    googleConfig.apiKey,
  );

  const response =
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

  if (!response.ok) {
    const responseBody =
      await response.text();

    console.error(
      "Google Place Photo rechazó la solicitud:",
      {
        status:
          response.status,

        reference:
          normalizedReference,

        maxWidthPx:
          normalizedWidth,

        responseBody,
      },
    );

    throw createServiceError(
      "No fue posible obtener la fotografía de Google.",
      response.status === 404
        ? 404
        : 502,
    );
  }

  const data =
    await response.json();

  const photoUri =
    cleanText(
      data?.photoUri,
    );

  if (!photoUri) {
    throw createServiceError(
      "Google no devolvió la URL de la fotografía.",
      502,
    );
  }

  return {
    photoUri,
    maxWidthPx:
      normalizedWidth,
  };
}