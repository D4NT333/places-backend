import googleConfig, { validateGoogleConfig } from "../../../../config/google.js";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.googleMapsUri",
  "places.photos",
].join(",");

export default async function searchNearbyGooglePlacesService({ circle }) {
  validateGoogleConfig();

  if (!circle?.center?.latitude || !circle?.center?.longitude || !circle?.radius) {
    throw new Error("Invalid Google Places circle");
  }

  const body = {
    maxResultCount: 20,
    rankPreference: "DISTANCE",
    locationRestriction: {
      circle,
    },
  };

  const response = await fetch(googleConfig.places.searchNearbyEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": googleConfig.mapsApiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("Google Places API error:", data);

    throw new Error(
      data?.error?.message || "Error al consultar Google Places API"
    );
  }

  return data.places || [];
}