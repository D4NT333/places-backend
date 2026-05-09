import {
  isValidCell,
  getResolution,
  cellToLatLng,
  cellToBoundary,
} from "h3-js";

export default function buildGoogleCircleFromH3Service(hexId) {
  if (!hexId) {
    throw new Error("hexId is required");
  }

  if (!isValidCell(hexId)) {
    throw new Error("Invalid H3 hexId");
  }

  const resolution = getResolution(hexId);

  const [centerLat, centerLng] = cellToLatLng(hexId);

  const center = {
    latitude: centerLat,
    longitude: centerLng,
  };

  const boundary = cellToBoundary(hexId).map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  }));

  const distances = boundary.map((point) =>
    haversineDistanceMeters(center, point)
  );

  const radiusMeters = Math.ceil(Math.max(...distances));

  const circle = {
    center,
    radius: radiusMeters,
  };

  return {
    hexId,
    resolution,
    center,
    boundary,
    radiusMeters,
    circle,
  };
}

function haversineDistanceMeters(pointA, pointB) {
  const R = 6371000;

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