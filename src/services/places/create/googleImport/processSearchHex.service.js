import {
  getResolution,
  cellToChildren,
} from "h3-js";

import buildGoogleCircleFromH3Service from "./buildGoogleCircleFromH3.service.js";
import searchNearbyGooglePlacesService from "./searchNearbyGooglePlaces.service.js";

const GOOGLE_MAX_RESULTS = 20;

function hasReachedSafetyLimit({
  context,
  maxGoogleRequests,
  maxUniquePlaces,
}) {
  if (
    context.googleRequestsCount >=
    maxGoogleRequests
  ) {
    context.stoppedByRequestLimit = true;

    return true;
  }

  if (
    context.uniquePlacesMap.size >=
    maxUniquePlaces
  ) {
    context.stoppedByPlacesLimit = true;

    return true;
  }

  return false;
}

export default async function processSearchHexService({
  hexId,
  maxResolution = 10,

  /*
   * Contexto compartido por toda la búsqueda.
   * Lo crea createPlaceCandidateService.
   */
  context = null,

  maxGoogleRequests = 300,
  maxUniquePlaces = 2000,
}) {
  /*
   * Compatibilidad:
   *
   * Si este servicio se llama desde otro lugar
   * sin contexto, crea uno local y continúa
   * funcionando como antes.
   */
  const discoveryContext =
    context || {
      googleRequestsCount: 0,

      uniquePlacesMap:
        new Map(),

      stoppedByRequestLimit:
        false,

      stoppedByPlacesLimit:
        false,
    };

  /*
   * No hacemos otra consulta si ya se alcanzó
   * alguno de los límites globales.
   */
  if (
    hasReachedSafetyLimit({
      context:
        discoveryContext,

      maxGoogleRequests,

      maxUniquePlaces,
    })
  ) {
    return {
      processedHexes: [],
      places: [],
    };
  }

  const hexData =
    buildGoogleCircleFromH3Service(
      hexId,
    );

  const currentResolution =
    getResolution(
      hexId,
    );

  /*
   * Contamos la solicitud antes de enviarla
   * para nunca superar el límite.
   */
  discoveryContext
    .googleRequestsCount += 1;

  const places =
    await searchNearbyGooglePlacesService({
      circle:
        hexData.circle,
    });

  /*
   * Conservamos el Map local que ya tenías
   * para devolver los lugares de esta rama.
   */
  const placesMap =
    new Map();

  for (const place of places) {
    if (!place?.id) {
      continue;
    }

    /*
     * Deduplicación local de esta rama.
     */
    placesMap.set(
      place.id,
      place,
    );

    /*
     * Deduplicación global de toda la búsqueda.
     */
    if (
      discoveryContext
        .uniquePlacesMap
        .has(
          place.id,
        )
    ) {
      discoveryContext
        .uniquePlacesMap
        .set(
          place.id,
          place,
        );

      continue;
    }

    /*
     * No agregamos más lugares nuevos cuando
     * ya se alcanzó el máximo permitido.
     */
    if (
      discoveryContext
        .uniquePlacesMap
        .size >=
      maxUniquePlaces
    ) {
      discoveryContext
        .stoppedByPlacesLimit =
        true;

      break;
    }

    discoveryContext
      .uniquePlacesMap
      .set(
        place.id,
        place,
      );
  }

  const isSaturated =
    places.length >=
    GOOGLE_MAX_RESULTS;

  const canSubdivide =
    currentResolution <
    maxResolution;

  const reachedSafetyLimit =
    hasReachedSafetyLimit({
      context:
        discoveryContext,

      maxGoogleRequests,

      maxUniquePlaces,
    });

  const shouldSubdivide =
    isSaturated &&
    canSubdivide &&
    !reachedSafetyLimit;

  const currentHexSummary = {
    hexId,

    resolution:
      currentResolution,

    center:
      hexData.center,

    boundary:
      hexData.boundary,

    radiusMeters:
      hexData.radiusMeters,

    placesCount:
      places.length,

    saturated:
      isSaturated,

    subdivided:
      shouldSubdivide,
  };

  /*
   * Mismas reglas anteriores:
   *
   * - Menos de 20: termina la rama.
   * - Resolución máxima: termina la rama.
   * - Límite de seguridad: termina la búsqueda.
   */
  if (!shouldSubdivide) {
    return {
      processedHexes: [
        currentHexSummary,
      ],

      places:
        Array.from(
          placesMap.values(),
        ),
    };
  }

  const nextResolution =
    currentResolution + 1;

  const children =
    cellToChildren(
      hexId,
      nextResolution,
    );

  const processedHexes = [
    currentHexSummary,
  ];

  /*
   * Se siguen consultando TODOS los hijos
   * de una celda saturada.
   */
  for (const childHexId of children) {
    /*
     * Solo detenemos el recorrido si se alcanzó
     * alguno de los límites globales.
     */
    if (
      hasReachedSafetyLimit({
        context:
          discoveryContext,

        maxGoogleRequests,

        maxUniquePlaces,
      })
    ) {
      break;
    }

    const childResult =
      await processSearchHexService({
        hexId:
          childHexId,

        maxResolution,

        context:
          discoveryContext,

        maxGoogleRequests,

        maxUniquePlaces,
      });

    processedHexes.push(
      ...childResult.processedHexes,
    );

    for (
      const place
      of childResult.places
    ) {
      if (place?.id) {
        placesMap.set(
          place.id,
          place,
        );
      }
    }
  }

  return {
    processedHexes,

    places:
      Array.from(
        placesMap.values(),
      ),
  };
}