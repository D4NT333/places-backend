import {
  isValidCell,
  getResolution,
  cellToChildren,
} from "h3-js";

import { db, FieldValue } from "../../../config/firebase.js";
import processSearchHexService from "./googleImport/processSearchHex.service.js";

const INITIAL_SEARCH_RESOLUTION = 8;
const MAX_SEARCH_RESOLUTION = 8;

const CANDIDATES_COLLECTION = "candidatesPlaces";
const REJECTED_GOOGLE_PLACES_COLLECTION =
  "rejectedGooglePlaces";
const DEFAULT_STATUS = "in_review";
const DEFAULT_SOURCE = "google";
const DEFAULT_IMPORTED_BY = "admin_uid_or_system";

const GOOGLE_DATA_TTL_DAYS = 20;

function chunkArray(array = [], size = 30) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

function getGoogleDataExpiresAt() {
  return new Date(Date.now() + GOOGLE_DATA_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function getGooglePlaceName(place = {}) {
  return place.displayName?.text || "Sin nombre";
}

function getGooglePlaceAddress(place = {}) {
  return place.formattedAddress || "Sin dirección";
}

function getGoogleMainType(place = {}) {
  if (!Array.isArray(place.types)) return "Sin tipo";

  return place.types[0] || "Sin tipo";
}

function getGoogleTypes(place = {}) {
  return Array.isArray(place.types) ? place.types : [];
}

async function getExistingCandidatePlaceIds(googlePlaceIds = []) {
  if (googlePlaceIds.length === 0) {
    return new Set();
  }

  const existingIds = new Set();
  const chunks = chunkArray(googlePlaceIds, 30);

  for (const chunk of chunks) {
    const refs = chunk.map((googlePlaceId) =>
      db.collection(CANDIDATES_COLLECTION).doc(googlePlaceId)
    );

    const snapshots = await db.getAll(...refs);

    snapshots.forEach((snapshot) => {
      if (snapshot.exists) {
        existingIds.add(snapshot.id);
      }
    });
  }

  return existingIds;
}

async function getRejectedGooglePlaceIds(
  googlePlaceIds = [],
) {
  if (googlePlaceIds.length === 0) {
    return new Set();
  }

  const rejectedIds =
    new Set();

  const chunks =
    chunkArray(
      googlePlaceIds,
      30,
    );

  for (const chunk of chunks) {
    const references =
      chunk.map(
        (googlePlaceId) =>
          db
            .collection(
              REJECTED_GOOGLE_PLACES_COLLECTION,
            )
            .doc(
              googlePlaceId,
            ),
      );

    const snapshots =
      await db.getAll(
        ...references,
      );

    snapshots.forEach(
      (snapshot) => {
        if (snapshot.exists) {
          rejectedIds.add(
            snapshot.id,
          );
        }
      },
    );
  }

  return rejectedIds;
}

function splitCandidatePlaces({
  places = [],
  existingCandidateIds =
    new Set(),
  rejectedGooglePlaceIds =
    new Set(),
}) {
  const newPlaces = [];
  const skippedPlaces = [];

  for (const place of places) {
    const googlePlaceId =
      place?.id;

    if (!googlePlaceId) {
      skippedPlaces.push({
        googlePlaceId:
          null,

        skippedReason:
          "missing_google_place_id",
      });

      continue;
    }

    /*
     * Primero revisamos la lista permanente
     * de lugares rechazados.
     *
     * Así el motivo registrado será
     * "previously_rejected", aunque el candidato
     * todavía exista en candidatesPlaces.
     */
    if (
      rejectedGooglePlaceIds.has(
        googlePlaceId,
      )
    ) {
      skippedPlaces.push({
        googlePlaceId,

        skippedReason:
          "previously_rejected",
      });

      continue;
    }

    /*
     * Después evitamos duplicar candidatos
     * pendientes, aceptados o ya registrados.
     */
    if (
      existingCandidateIds.has(
        googlePlaceId,
      )
    ) {
      skippedPlaces.push({
        googlePlaceId,

        skippedReason:
          "already_exists_in_candidates_places",
      });

      continue;
    }

    newPlaces.push(
      place,
    );
  }

  return {
    newPlaces,
    skippedPlaces,
  };
}

function buildCandidateData({
  place,
  parentHexId,
  importedBy,
}) {
  return {
    googlePlaceId: place.id,

    // Snapshot soft de Google.
    // Lo guardamos porque ya vino en la consulta Nearby Search.
    name: getGooglePlaceName(place),
    address: getGooglePlaceAddress(place),
    googleMainType: getGoogleMainType(place),
    types: getGoogleTypes(place),

    status: DEFAULT_STATUS,
    source: DEFAULT_SOURCE,
    parentHexId,
    importedBy,

    googleDataFetchedAt: FieldValue.serverTimestamp(),
    googleDataExpiresAt: getGoogleDataExpiresAt(),

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildRegisteredCandidateResponse({
  place,
  parentHexId,
  importedBy,
}) {
  return {
    id: place.id,
    googlePlaceId: place.id,
    name: getGooglePlaceName(place),
    address: getGooglePlaceAddress(place),
    googleMainType: getGoogleMainType(place),
    types: getGoogleTypes(place),
    status: DEFAULT_STATUS,
    source: DEFAULT_SOURCE,
    parentHexId,
    importedBy,
  };
}

async function registerCandidatePlaces({
  places = [],
  parentHexId,
  importedBy = DEFAULT_IMPORTED_BY,
}) {
  if (places.length === 0) {
    return {
      registeredCount: 0,
      registeredCandidates: [],
    };
  }

  // Firestore batch permite máximo 500 operaciones.
  // Usamos 450 por seguridad.
  const batches = chunkArray(places, 450);
  const registeredCandidates = [];

  for (const batchPlaces of batches) {
    const batch = db.batch();

    for (const place of batchPlaces) {
      const candidateRef = db.collection(CANDIDATES_COLLECTION).doc(place.id);

      const candidateData = buildCandidateData({
        place,
        parentHexId,
        importedBy,
      });

      batch.set(candidateRef, candidateData);

      registeredCandidates.push(
        buildRegisteredCandidateResponse({
          place,
          parentHexId,
          importedBy,
        })
      );
    }

    await batch.commit();
  }

  return {
    registeredCount: registeredCandidates.length,
    registeredCandidates,
  };
}

export default async function createPlaceCandidateService(
  hexId,
  options = {}
) {
  const importedBy = options.importedBy || DEFAULT_IMPORTED_BY;

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

  const googlePlaces = Array.from(placesMap.values());

  const googlePlaceIds = googlePlaces
    .map((place) => place.id)
    .filter(Boolean);

 const [
  existingCandidateIds,
  rejectedGooglePlaceIds,
] = await Promise.all([
  getExistingCandidatePlaceIds(
    googlePlaceIds,
  ),

  getRejectedGooglePlaceIds(
    googlePlaceIds,
  ),
]);

const {
  newPlaces,
  skippedPlaces,
} = splitCandidatePlaces({
  places:
    googlePlaces,

  existingCandidateIds,

  rejectedGooglePlaceIds,
});

  const registerResult = await registerCandidatePlaces({
    places: newPlaces,
    parentHexId: hexId,
    importedBy,
  });

  const skippedExistingCandidatesCount =
  skippedPlaces.filter(
    (place) =>
      place.skippedReason ===
      "already_exists_in_candidates_places",
  ).length;

const skippedRejectedPlacesCount =
  skippedPlaces.filter(
    (place) =>
      place.skippedReason ===
      "previously_rejected",
  ).length;

const skippedWithoutGoogleIdCount =
  skippedPlaces.filter(
    (place) =>
      place.skippedReason ===
      "missing_google_place_id",
  ).length;

  return {
    parentHexId: hexId,
    parentResolution: 7,
    initialSearchResolution: INITIAL_SEARCH_RESOLUTION,
    maxSearchResolution: MAX_SEARCH_RESOLUTION,
    initialChildrenCount: h8Children.length,
    processedHexesCount: processedHexes.length,

    googlePlacesCount: googlePlaces.length,
    newPlacesCount: newPlaces.length,
    skippedPlacesCount: skippedPlaces.length,
    registeredCandidatesCount: registerResult.registeredCount,

    processedHexes,

    // Lugares nuevos crudos de Google. Útiles para debug.
    places: newPlaces,

    // Candidatos ya registrados con snapshot soft.
    registeredCandidates: registerResult.registeredCandidates,

    skippedPlaces,

    stats: {
  googlePlacesReceived:
    googlePlaces.length,

  uniqueGooglePlacesInRun:
    googlePlaces.length,

  alreadyExistingInCandidatesPlaces:
    skippedExistingCandidatesCount,

  previouslyRejected:
    skippedRejectedPlacesCount,

  missingGooglePlaceId:
    skippedWithoutGoogleIdCount,

  totalSkipped:
    skippedPlaces.length,

  readyToReview:
    newPlaces.length,

  registeredInCandidatesPlaces:
    registerResult.registeredCount,
},

    status: "ok",
  };
}