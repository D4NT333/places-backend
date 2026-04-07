import {
  isValidCell,
  cellToLatLng,
  cellToBoundary,
} from "h3-js";

export async function discoverPlacesByH3Service(hexId) {
  if (!hexId) {
    throw new Error("hexId is required");
  }

  if (!isValidCell(hexId)) {
    throw new Error("Invalid H3 hexId");
  }

  // 1. Centro del hex
  const [centerLat, centerLng] = cellToLatLng(hexId);

  const center = {
    latitude: centerLat,
    longitude: centerLng,
  };

  // 2. Vértices del hex
  const boundaryRaw = cellToBoundary(hexId);

  const boundary = boundaryRaw.map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  }));

  // 3. Calcular radio:
  // distancia máxima del centro a cualquiera de los vértices
  const distances = boundary.map((point) =>
    haversineDistanceMeters(center, point)
  );

  const radiusMeters = Math.ceil(Math.max(...distances));

  // 4. Armar círculo para Google Places New
  const circle = {
    center: {
      latitude: center.latitude,
      longitude: center.longitude,
    },
    radius: radiusMeters,
  };


  return {
    hexId,
    center,
    boundary,
    radiusMeters,
    circle,
    status: "ok",
  };
}

/**
 * Calcula distancia entre dos coordenadas usando Haversine
 * Retorna metros
 */
function haversineDistanceMeters(pointA, pointB) {
  const R = 6371000; // radio de la Tierra en metros

  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);
  const deltaLat = toRadians(pointB.latitude - pointA.latitude);
  const deltaLng = toRadians(pointB.longitude - pointA.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}