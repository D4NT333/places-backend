import {
  isValidCell,
  getResolution,
  cellToChildren,
} from "h3-js";

import processSearchHexService from "./googleImport/processSearchHex.service.js";

const INITIAL_SEARCH_RESOLUTION = 8;
const MAX_SEARCH_RESOLUTION = 8; // H3 resolutions 8-10 are good for discovering places in a city-level area

export default async function createPlaceCandidateService(hexId) {
  if (!hexId) {
    throw new Error("hexId is required");
  }

  if (!isValidCell(hexId)) {
    throw new Error("Invalid H3 hexId");
  }

  const resolution = getResolution(hexId);

  if (resolution !== 7) {
    throw new Error(`Expected H7 hex, received H${resolution}`);
  }

  const h8Children = cellToChildren(hexId, INITIAL_SEARCH_RESOLUTION);

  const processedHexes = [];
  const placesMap = new Map();

  for (const h8HexId of h8Children) {
    const result = await processSearchHexService({
      hexId: h8HexId,
      maxResolution: MAX_SEARCH_RESOLUTION,
    });

    processedHexes.push(...result.processedHexes);

    for (const place of result.places) {
      if (place.id) {
        placesMap.set(place.id, place);
      }
    }
  }

  const places = Array.from(placesMap.values());

  return {
    parentHexId: hexId,
    parentResolution: 7,
    initialSearchResolution: INITIAL_SEARCH_RESOLUTION,
    maxSearchResolution: MAX_SEARCH_RESOLUTION,
    initialChildrenCount: h8Children.length,
    processedHexesCount: processedHexes.length,
    placesCount: places.length,
    processedHexes,
    places,
    status: "ok",
  };
}