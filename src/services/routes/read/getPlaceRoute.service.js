const GOOGLE_ROUTES_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

function normalizeTravelMode(value) {
  const mode = String(value || "DRIVE").toUpperCase();

  const allowedModes = [
    "DRIVE",
    "WALK",
    "BICYCLE",
    "TWO_WHEELER",
    "TRANSIT",
  ];

  if (!allowedModes.includes(mode)) {
    return "DRIVE";
  }

  return mode;
}

function parseCoordinate(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return parsedValue;
}

function getPlaceGooglePlaceId(place) {
  return (
    place?.googlePlaceId ||
    place?.origin?.googlePlaceId ||
    place?.origin?.candidateId ||
    null
  );
}

function getPlaceDestination(place) {
  const lat = parseCoordinate(place?.location?.lat);
  const lng = parseCoordinate(place?.location?.lng);

  if (lat !== null && lng !== null) {
    return {
      type: "coordinates",
      lat,
      lng,
    };
  }

  const googlePlaceId = getPlaceGooglePlaceId(place);

  if (googlePlaceId) {
    return {
      type: "placeId",
      placeId: googlePlaceId,
    };
  }

  if (place?.address && String(place.address).trim()) {
    return {
      type: "address",
      address: String(place.address).trim(),
    };
  }

  return null;
}

function buildGoogleWaypointFromDestination(destination) {
  if (destination.type === "coordinates") {
    return {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    };
  }

  if (destination.type === "placeId") {
    return {
      placeId: destination.placeId,
    };
  }

  if (destination.type === "address") {
    return {
      address: destination.address,
    };
  }

  return null;
}

function normalizeDuration(duration) {
  if (!duration) return null;

  const seconds = Number(String(duration).replace("s", ""));

  if (!Number.isFinite(seconds)) {
    return duration;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));

  return {
    raw: duration,
    seconds,
    minutes,
    label: `${minutes} min`,
  };
}

function normalizeDistance(distanceMeters) {
  const meters = Number(distanceMeters || 0);

  if (!Number.isFinite(meters) || meters <= 0) {
    return {
      meters: 0,
      kilometers: 0,
      label: "Sin distancia",
    };
  }

  if (meters < 1000) {
    return {
      meters,
      kilometers: meters / 1000,
      label: `${Math.round(meters)} m`,
    };
  }

  const kilometers = meters / 1000;

  return {
    meters,
    kilometers,
    label: `${kilometers.toFixed(1)} km`,
  };
}

export default async function getPlaceRouteService({
  originLat,
  originLng,
  place,
  travelMode = "DRIVE",
}) {
  const parsedOriginLat = parseCoordinate(originLat);
  const parsedOriginLng = parseCoordinate(originLng);

  if (parsedOriginLat === null || parsedOriginLng === null) {
    const error = new Error("La ubicación de origen no es válida.");
    error.statusCode = 400;
    throw error;
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    const error = new Error("Falta configurar GOOGLE_MAPS_API_KEY.");
    error.statusCode = 500;
    throw error;
  }

  const destination = getPlaceDestination(place);

  if (!destination) {
    const error = new Error("El lugar no tiene una ubicación válida.");
    error.statusCode = 422;
    throw error;
  }

  const normalizedTravelMode = normalizeTravelMode(travelMode);

  const body = {
    origin: {
      location: {
        latLng: {
          latitude: parsedOriginLat,
          longitude: parsedOriginLng,
        },
      },
    },
    destination: buildGoogleWaypointFromDestination(destination),
    travelMode: normalizedTravelMode,
    polylineQuality: "OVERVIEW",
    polylineEncoding: "ENCODED_POLYLINE",
    languageCode: "es-MX",
    units: "METRIC",
  };

  if (
    normalizedTravelMode === "DRIVE" ||
    normalizedTravelMode === "TWO_WHEELER"
  ) {
    body.routingPreference = "TRAFFIC_AWARE";
  }

  const response = await fetch(GOOGLE_ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("Google Routes API error:", JSON.stringify(data, null, 2));

    const error = new Error("No se pudo calcular la ruta.");
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  const route = data?.routes?.[0];

  if (!route?.polyline?.encodedPolyline) {
    const error = new Error("No se encontró una ruta disponible.");
    error.statusCode = 404;
    throw error;
  }

  return {
    provider: "google_routes",
    travelMode: normalizedTravelMode,
    destinationSource: destination.type,
    distanceMeters: route.distanceMeters || 0,
    distance: normalizeDistance(route.distanceMeters),
    duration: normalizeDuration(route.duration),
    encodedPolyline: route.polyline.encodedPolyline,
  };
}