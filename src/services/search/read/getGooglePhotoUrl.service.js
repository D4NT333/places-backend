const GOOGLE_PLACES_BASE_URL =
  "https://places.googleapis.com/v1";

const DEFAULT_MAX_WIDTH_PX = 400;
const MIN_MAX_WIDTH_PX = 100;
const MAX_MAX_WIDTH_PX = 1200;

const GOOGLE_PHOTO_REFERENCE_REGEX =
  /^places\/[^/]+\/photos\/[^/]+$/;

const photoUrlCache = new Map();

const CACHE_TTL_MS =
  30 * 60 * 1000;

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function createServiceError(
  message,
  statusCode
) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
}

function normalizeMaxWidthPx(value) {
  const parsedValue =
    Number(value);

  if (
    !Number.isInteger(parsedValue)
  ) {
    return DEFAULT_MAX_WIDTH_PX;
  }

  return Math.min(
    Math.max(
      parsedValue,
      MIN_MAX_WIDTH_PX
    ),
    MAX_MAX_WIDTH_PX
  );
}

function getCachedPhotoUrl(
  reference,
  maxWidthPx
) {
  const cacheKey =
    `${reference}:${maxWidthPx}`;

  const cachedValue =
    photoUrlCache.get(cacheKey);

  if (!cachedValue) {
    return null;
  }

  const isExpired =
    Date.now() -
      cachedValue.cachedAt >
    CACHE_TTL_MS;

  if (isExpired) {
    photoUrlCache.delete(cacheKey);

    return null;
  }

  return cachedValue.photoUrl;
}

function cachePhotoUrl(
  reference,
  maxWidthPx,
  photoUrl
) {
  const cacheKey =
    `${reference}:${maxWidthPx}`;

  photoUrlCache.set(cacheKey, {
    photoUrl,
    cachedAt: Date.now(),
  });
}

export default async function getGooglePhotoUrlService({
  reference,
  maxWidthPx,
}) {
  const normalizedReference =
    cleanString(reference);

  if (!normalizedReference) {
    throw createServiceError(
      "La referencia de la fotografía es obligatoria.",
      400
    );
  }

  if (
    !GOOGLE_PHOTO_REFERENCE_REGEX.test(
      normalizedReference
    )
  ) {
    throw createServiceError(
      "La referencia de la fotografía de Google no es válida.",
      400
    );
  }

  const googleApiKey =
    cleanString(
      process.env
        .GOOGLE_PLACES_API_KEY
    ) ||
    cleanString(
      process.env
        .GOOGLE_MAPS_API_KEY
    );

  if (!googleApiKey) {
    throw createServiceError(
      "La API key de Google Places no está configurada.",
      500
    );
  }

  const normalizedMaxWidthPx =
    normalizeMaxWidthPx(
      maxWidthPx
    );

  const cachedPhotoUrl =
    getCachedPhotoUrl(
      normalizedReference,
      normalizedMaxWidthPx
    );

  if (cachedPhotoUrl) {
    return {
      photoUrl:
        cachedPhotoUrl,

      reference:
        normalizedReference,

      maxWidthPx:
        normalizedMaxWidthPx,

      fromCache:
        true,
    };
  }

  const googleUrl =
    `${GOOGLE_PLACES_BASE_URL}` +
    `/${normalizedReference}/media`;

  const queryParams =
    new URLSearchParams({
      maxWidthPx:
        String(
          normalizedMaxWidthPx
        ),

      skipHttpRedirect:
        "true",

      key:
        googleApiKey,
    });

  let response;

  try {
    response = await fetch(
      `${googleUrl}?${queryParams.toString()}`,
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "Error de red al obtener fotografía de Google:",
      error
    );

    throw createServiceError(
      "No fue posible comunicarse con Google Places.",
      502
    );
  }

  let responseData = null;

  try {
    responseData =
      await response.json();
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    console.error(
      "Google Places rechazó la solicitud de fotografía:",
      {
        status:
          response.status,

        response:
          responseData,
      }
    );

    const statusCode =
      response.status === 404
        ? 404
        : 502;

    throw createServiceError(
      responseData?.error?.message ||
        "Google Places no pudo obtener la fotografía.",
      statusCode
    );
  }

  const photoUrl =
    cleanString(
      responseData?.photoUri
    );

  if (!photoUrl) {
    throw createServiceError(
      "Google Places no devolvió una URL para la fotografía.",
      502
    );
  }

  cachePhotoUrl(
    normalizedReference,
    normalizedMaxWidthPx,
    photoUrl
  );

  return {
    photoUrl,

    reference:
      normalizedReference,

    maxWidthPx:
      normalizedMaxWidthPx,

    fromCache:
      false,
  };
}