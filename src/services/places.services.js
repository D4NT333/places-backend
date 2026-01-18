export async function searchNearbyService({ lat, lng, radius }) {
  const body = {
    includedTypes: ["restaurant"],
    maxResultCount: 1,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
  };

  const resp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount",
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();

  if (!resp.ok) {
    const err = new Error("Google Places error");
    err.status = resp.status;
    err.details = data;
    throw err;
  }

  return data;
}
