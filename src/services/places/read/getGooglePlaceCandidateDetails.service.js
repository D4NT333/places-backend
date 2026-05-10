import googleConfig, { validateGoogleConfig } from "../../../config/google.js";

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryType",
  "rating",
  "userRatingCount",
  "priceLevel",
  "regularOpeningHours",
  "googleMapsUri",
  "photos",
].join(",");

const MAX_PHOTOS = 10;
const DEFAULT_PHOTO_MAX_WIDTH = 900;

function getGooglePlacesBaseUrl() {
  return (
    googleConfig.placesBaseUrl ||
    googleConfig.places?.baseUrl ||
    "https://places.googleapis.com/v1"
  );
}

function getPhotoMediaUrl(photoName, maxWidthPx = DEFAULT_PHOTO_MAX_WIDTH) {
  if (!photoName) return null;

  const baseUrl = getGooglePlacesBaseUrl();

  return `${baseUrl}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${googleConfig.mapsApiKey}`;
}

function mapPhoto(photo = {}) {
  return {
    name: photo.name || null,
    widthPx: photo.widthPx || null,
    heightPx: photo.heightPx || null,
    authorAttributions: Array.isArray(photo.authorAttributions)
      ? photo.authorAttributions
      : [],
    photoUrl: getPhotoMediaUrl(photo.name),
  };
}

function mapOpeningHours(openingHours = null) {
  if (!openingHours) {
    return {
      openNow: null,
      weekdayDescriptions: [],
      periods: [],
    };
  }

  return {
    openNow: openingHours.openNow ?? null,
    weekdayDescriptions: Array.isArray(openingHours.weekdayDescriptions)
      ? openingHours.weekdayDescriptions
      : [],
    periods: Array.isArray(openingHours.periods) ? openingHours.periods : [],
  };
}

export default async function getGooglePlaceCandidateDetailsService(
  googlePlaceId
) {
  validateGoogleConfig();

  if (!googlePlaceId) {
    throw new Error("googlePlaceId is required");
  }

  const url = `${getGooglePlacesBaseUrl()}/places/${googlePlaceId}`;

  console.log("Se ejecutó Google Place Details:", {
  googlePlaceId,
  fieldMask: DETAILS_FIELD_MASK,
});

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleConfig.mapsApiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("Google Place Details error:", data);

    throw new Error(
      data?.error?.message || "Error al consultar detalles de Google Place"
    );
  }

  const photos = Array.isArray(data.photos)
    ? data.photos.slice(0, MAX_PHOTOS).map(mapPhoto)
    : [];

  return {
    googlePlaceId: data.id || googlePlaceId,

    name: data.displayName?.text || "Sin nombre",
    address: data.formattedAddress || "Sin dirección",

    location: data.location
      ? {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        }
      : null,

    googleMainType:
      data.primaryType ||
      (Array.isArray(data.types) ? data.types[0] : null) ||
      "Sin tipo",

    types: Array.isArray(data.types) ? data.types : [],

    rating: data.rating ?? null,
    userRatingCount: data.userRatingCount ?? null,
    priceLevel: data.priceLevel || null,
    googleMapsUri: data.googleMapsUri || null,

    openingHours: mapOpeningHours(data.regularOpeningHours),

    photos,

    fetchedAt: new Date().toISOString(),
  };
}