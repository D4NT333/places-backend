import {
  getResolution,
  cellToChildren,
} from "h3-js";

import buildGoogleCircleFromH3Service from "./buildGoogleCircleFromH3.service.js";
import searchNearbyGooglePlacesService from "./searchNearbyGooglePlaces.service.js";

const GOOGLE_MAX_RESULTS = 20;

export default async function processSearchHexService({
  hexId,
  maxResolution = 10,
}) {
  const hexData = buildGoogleCircleFromH3Service(hexId);
  const currentResolution = getResolution(hexId);

  const places = await searchNearbyGooglePlacesService({
    circle: hexData.circle,
  });

  const isSaturated = places.length >= GOOGLE_MAX_RESULTS;
  const canSubdivide = currentResolution < maxResolution;

  const currentHexSummary = {
    hexId,
    resolution: currentResolution,
    center: hexData.center,
    boundary: hexData.boundary,
    radiusMeters: hexData.radiusMeters,
    placesCount: places.length,
    saturated: isSaturated,
    subdivided: isSaturated && canSubdivide,
  };

  if (!isSaturated || !canSubdivide) {
    return {
      processedHexes: [currentHexSummary],
      places,
    };
  }

  const nextResolution = currentResolution + 1;
  const children = cellToChildren(hexId, nextResolution);

  const processedHexes = [currentHexSummary];
  const placesMap = new Map();

  for (const place of places) {
    if (place.id) {
      placesMap.set(place.id, place);
    }
  }

  for (const childHexId of children) {
    const childResult = await processSearchHexService({
      hexId: childHexId,
      maxResolution,
    });

    processedHexes.push(...childResult.processedHexes);

    for (const place of childResult.places) {
      if (place.id) {
        placesMap.set(place.id, place);
      }
    }
  }

  return {
    processedHexes,
    places: Array.from(placesMap.values()),
  };
}