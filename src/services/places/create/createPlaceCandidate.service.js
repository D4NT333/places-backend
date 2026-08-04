import {
  isValidCell,
  getResolution,
  cellToChildren,
} from "h3-js";

import {
  db,
  FieldValue,
} from "../../../config/firebase.js";

import processSearchHexService from "./googleImport/processSearchHex.service.js";

const INITIAL_SEARCH_RESOLUTION = 8;
const MAX_SEARCH_RESOLUTION = 11;

/*
 * Protecciones globales para una ejecución.
 *
 * La búsqueda se detiene cuando se alcanza
 * cualquiera de estos dos límites.
 */
const MAX_GOOGLE_REQUESTS_PER_DISCOVERY = 300;
const MAX_UNIQUE_PLACES_PER_DISCOVERY = 2000;

const CANDIDATES_COLLECTION =
  "candidatesPlaces";

const REJECTED_GOOGLE_PLACES_COLLECTION =
  "rejectedGooglePlaces";

const DEFAULT_STATUS =
  "in_review";

const DEFAULT_SOURCE =
  "google";

const DEFAULT_IMPORTED_BY =
  "admin_uid_or_system";

const GOOGLE_DATA_TTL_DAYS = 20;

function chunkArray(
  array = [],
  size = 30,
) {
  const chunks = [];

  for (
    let index = 0;
    index < array.length;
    index += size
  ) {
    chunks.push(
      array.slice(
        index,
        index + size,
      ),
    );
  }

  return chunks;
}

function getGoogleDataExpiresAt() {
  return new Date(
    Date.now() +
      GOOGLE_DATA_TTL_DAYS *
        24 *
        60 *
        60 *
        1000,
  );
}

function getGooglePlaceName(
  place = {},
) {
  return (
    place.displayName?.text ||
    "Sin nombre"
  );
}

function getGooglePlaceAddress(
  place = {},
) {
  return (
    place.formattedAddress ||
    "Sin dirección"
  );
}

function getGoogleMainType(
  place = {},
) {
  if (
    !Array.isArray(
      place.types,
    )
  ) {
    return "Sin tipo";
  }

  return (
    place.types[0] ||
    "Sin tipo"
  );
}

function getGoogleTypes(
  place = {},
) {
  return Array.isArray(
    place.types,
  )
    ? place.types
    : [];
}

async function getExistingCandidatePlaceIds(
  googlePlaceIds = [],
) {
  if (
    googlePlaceIds.length === 0
  ) {
    return new Set();
  }

  const existingIds =
    new Set();

  const chunks =
    chunkArray(
      googlePlaceIds,
      30,
    );

  for (
    const chunk
    of chunks
  ) {
    const references =
      chunk.map(
        (googlePlaceId) =>
          db
            .collection(
              CANDIDATES_COLLECTION,
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
        if (
          snapshot.exists
        ) {
          existingIds.add(
            snapshot.id,
          );
        }
      },
    );
  }

  return existingIds;
}

async function getRejectedGooglePlaceIds(
  googlePlaceIds = [],
) {
  if (
    googlePlaceIds.length === 0
  ) {
    return new Set();
  }

  const rejectedIds =
    new Set();

  const chunks =
    chunkArray(
      googlePlaceIds,
      30,
    );

  for (
    const chunk
    of chunks
  ) {
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
        if (
          snapshot.exists
        ) {
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

  for (
    const place
    of places
  ) {
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
     * Primero se revisa la lista
     * permanente de rechazados.
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
     * Después se evita registrar otra vez
     * un candidato existente.
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
    googlePlaceId:
      place.id,

    /*
     * Snapshot ligero obtenido durante
     * Nearby Search.
     */
    name:
      getGooglePlaceName(
        place,
      ),

    address:
      getGooglePlaceAddress(
        place,
      ),

    googleMainType:
      getGoogleMainType(
        place,
      ),

    types:
      getGoogleTypes(
        place,
      ),

    status:
      DEFAULT_STATUS,

    source:
      DEFAULT_SOURCE,

    parentHexId,

    importedBy,

    googleDataFetchedAt:
      FieldValue
        .serverTimestamp(),

    googleDataExpiresAt:
      getGoogleDataExpiresAt(),

    createdAt:
      FieldValue
        .serverTimestamp(),

    updatedAt:
      FieldValue
        .serverTimestamp(),
  };
}

function buildRegisteredCandidateResponse({
  place,
  parentHexId,
  importedBy,
}) {
  return {
    id:
      place.id,

    googlePlaceId:
      place.id,

    name:
      getGooglePlaceName(
        place,
      ),

    address:
      getGooglePlaceAddress(
        place,
      ),

    googleMainType:
      getGoogleMainType(
        place,
      ),

    types:
      getGoogleTypes(
        place,
      ),

    status:
      DEFAULT_STATUS,

    source:
      DEFAULT_SOURCE,

    parentHexId,

    importedBy,
  };
}

async function registerCandidatePlaces({
  places = [],
  parentHexId,
  importedBy =
    DEFAULT_IMPORTED_BY,
}) {
  if (
    places.length === 0
  ) {
    return {
      registeredCount: 0,
      registeredCandidates: [],
    };
  }

  /*
   * Firestore permite hasta 500 operaciones
   * por batch. Se dejan 450 por seguridad.
   */
  const batches =
    chunkArray(
      places,
      450,
    );

  const registeredCandidates =
    [];

  for (
    const batchPlaces
    of batches
  ) {
    const batch =
      db.batch();

    for (
      const place
      of batchPlaces
    ) {
      const candidateReference =
        db
          .collection(
            CANDIDATES_COLLECTION,
          )
          .doc(
            place.id,
          );

      const candidateData =
        buildCandidateData({
          place,
          parentHexId,
          importedBy,
        });

      batch.set(
        candidateReference,
        candidateData,
      );

      registeredCandidates.push(
        buildRegisteredCandidateResponse({
          place,
          parentHexId,
          importedBy,
        }),
      );
    }

    await batch.commit();
  }

  return {
    registeredCount:
      registeredCandidates.length,

    registeredCandidates,
  };
}

export default async function createPlaceCandidateService(
  hexId,
  options = {},
) {
  const importedBy =
    options.importedBy ||
    DEFAULT_IMPORTED_BY;

  if (!hexId) {
    throw new Error(
      "hexId is required",
    );
  }

  if (
    !isValidCell(
      hexId,
    )
  ) {
    throw new Error(
      "Invalid H3 hexId",
    );
  }

  const resolution =
    getResolution(
      hexId,
    );

  if (
    resolution !== 7
  ) {
    throw new Error(
      `Expected H7 hex, received H${resolution}`,
    );
  }

  /*
   * La zona seleccionada es H7.
   * La exploración comienza consultando
   * todos sus hijos H8.
   */
  const initialSearchHexes =
    cellToChildren(
      hexId,
      INITIAL_SEARCH_RESOLUTION,
    );

  const processedHexes = [];

  /*
   * Este Map es el deduplicador global
   * de toda la ejecución.
   *
   * Un Google Place ID solamente puede
   * existir una vez dentro del resultado.
   */
  const placesMap =
    new Map();

  /*
   * Contexto compartido entre todas las
   * ramas de la búsqueda recursiva.
   *
   * Esto permite aplicar límites globales,
   * no límites independientes por cada H8.
   */
  const discoveryContext = {
    googleRequestsCount: 0,

    uniquePlacesMap:
      placesMap,

    stoppedByRequestLimit:
      false,

    stoppedByPlacesLimit:
      false,
  };

  for (
    const searchHexId
    of initialSearchHexes
  ) {
    /*
     * Si una rama anterior alcanzó alguno
     * de los límites, ya no comenzamos
     * otra rama H8.
     */
    if (
      discoveryContext
        .stoppedByRequestLimit ||
      discoveryContext
        .stoppedByPlacesLimit
    ) {
      break;
    }

    const result =
      await processSearchHexService({
        hexId:
          searchHexId,

        maxResolution:
          MAX_SEARCH_RESOLUTION,

        context:
          discoveryContext,

        maxGoogleRequests:
          MAX_GOOGLE_REQUESTS_PER_DISCOVERY,

        maxUniquePlaces:
          MAX_UNIQUE_PLACES_PER_DISCOVERY,
      });

    processedHexes.push(
      ...result.processedHexes,
    );

    /*
     * processSearchHexService ya agregó
     * los resultados al Map global.
     *
     * Este recorrido se conserva para
     * mantener el mismo comportamiento
     * y formato de retorno que existía.
     */
    for (
      const place
      of result.places
    ) {
      if (
        place?.id &&
        placesMap.size <
          MAX_UNIQUE_PLACES_PER_DISCOVERY
      ) {
        placesMap.set(
          place.id,
          place,
        );
      }
    }
  }

  /*
   * Aquí ya están deduplicados todos
   * los resultados por Google Place ID.
   */
  const googlePlaces =
    Array.from(
      placesMap.values(),
    );

  const googlePlaceIds =
    googlePlaces
      .map(
        (place) =>
          place.id,
      )
      .filter(
        Boolean,
      );

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

  const registerResult =
    await registerCandidatePlaces({
      places:
        newPlaces,

      parentHexId:
        hexId,

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

  let stoppedReason =
    "completed";

  if (
    discoveryContext
      .stoppedByRequestLimit
  ) {
    stoppedReason =
      "google_request_limit";
  } else if (
    discoveryContext
      .stoppedByPlacesLimit
  ) {
    stoppedReason =
      "unique_places_limit";
  }

  return {
    parentHexId:
      hexId,

    parentResolution:
      resolution,

    initialSearchResolution:
      INITIAL_SEARCH_RESOLUTION,

    maxSearchResolution:
      MAX_SEARCH_RESOLUTION,

    initialChildrenCount:
      initialSearchHexes.length,

    processedHexesCount:
      processedHexes.length,

    googleRequestsCount:
      discoveryContext
        .googleRequestsCount,

    googlePlacesCount:
      googlePlaces.length,

    newPlacesCount:
      newPlaces.length,

    skippedPlacesCount:
      skippedPlaces.length,

    registeredCandidatesCount:
      registerResult
        .registeredCount,

    stoppedByRequestLimit:
      discoveryContext
        .stoppedByRequestLimit,

    stoppedByPlacesLimit:
      discoveryContext
        .stoppedByPlacesLimit,

    stoppedReason,

    limits: {
      maxGoogleRequests:
        MAX_GOOGLE_REQUESTS_PER_DISCOVERY,

      maxUniquePlaces:
        MAX_UNIQUE_PLACES_PER_DISCOVERY,
    },

    /*
     * Se mantienen estas propiedades
     * para no romper el comportamiento
     * que ya tenía el servicio.
     */
    processedHexes,

    places:
      newPlaces,

    registeredCandidates:
      registerResult
        .registeredCandidates,

    skippedPlaces,

    stats: {
      googleRequests:
        discoveryContext
          .googleRequestsCount,

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
        registerResult
          .registeredCount,

      processedHexes:
        processedHexes.length,

      stoppedReason,
    },

    status:
      "ok",
  };
}