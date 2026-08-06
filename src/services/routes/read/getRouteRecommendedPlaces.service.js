import { db } from "../../../config/firebase.js";

const MAX_ROUTE_DISTANCE_KM = 1;
const MAX_RECOMMENDATIONS = 10;



function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function removeAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeRecommendationKey(value) {
  let normalized =
    removeAccents(
      cleanText(value),
    )
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");

  const removablePrefixes = [
    "tag_",
    "subtag_",
    "approach_",
    "profile_",
    "subprofile_",
  ];

  removablePrefixes.forEach(
    (prefix) => {
      if (
        normalized.startsWith(
          prefix,
        )
      ) {
        normalized =
          normalized.slice(
            prefix.length,
          );
      }
    },
  );

  /*
   * Equivalencias entre los nombres del
   * recomendador y los IDs de catálogo.
   */
  const aliases = {
    gastronomia:
      "gastronomy",

    gastronomico:
      "gastronomy",

    culinario:
      "gastronomy",

    comida:
      "gastronomy",
  };

  return (
    aliases[normalized] ||
    normalized
  );
}

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function decodePolyline(encoded) {
  if (!encoded) {
    return [];
  }

  let index = 0;
  let lat = 0;
  let lng = 0;

  const coordinates = [];

  while (index < encoded.length) {
    let byte;
    let shift = 0;
    let result = 0;

    do {
      byte =
        encoded.charCodeAt(index++) -
        63;

      result |=
        (byte & 0x1f) <<
        shift;

      shift += 5;
    } while (byte >= 0x20);

    const deltaLat =
      result & 1
        ? ~(result >> 1)
        : result >> 1;

    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte =
        encoded.charCodeAt(index++) -
        63;

      result |=
        (byte & 0x1f) <<
        shift;

      shift += 5;
    } while (byte >= 0x20);

    const deltaLng =
      result & 1
        ? ~(result >> 1)
        : result >> 1;

    lng += deltaLng;

    coordinates.push({
      lat:
        lat / 1e5,

      lng:
        lng / 1e5,
    });
  }

  return coordinates;
}

function degreesToRadians(value) {
  return (
    value *
    Math.PI
  ) / 180;
}

function haversineDistanceKm(
  firstPoint,
  secondPoint,
) {
  const earthRadiusKm = 6371;

  const firstLat =
    degreesToRadians(
      firstPoint.lat,
    );

  const secondLat =
    degreesToRadians(
      secondPoint.lat,
    );

  const deltaLat =
    degreesToRadians(
      secondPoint.lat -
        firstPoint.lat,
    );

  const deltaLng =
    degreesToRadians(
      secondPoint.lng -
        firstPoint.lng,
    );

  const haversineValue =
    Math.sin(
      deltaLat / 2,
    ) ** 2 +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(
        deltaLng / 2,
      ) ** 2;

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(
        haversineValue,
      ),
      Math.sqrt(
        1 -
          haversineValue,
      ),
    );

  return (
    earthRadiusKm *
    angularDistance
  );
}

function projectPointToKm(
  point,
  referenceLat,
) {
  const kilometersPerDegreeLat =
    110.574;

  const kilometersPerDegreeLng =
    111.32 *
    Math.cos(
      degreesToRadians(
        referenceLat,
      ),
    );

  return {
    x:
      point.lng *
      kilometersPerDegreeLng,

    y:
      point.lat *
      kilometersPerDegreeLat,
  };
}

function getDistanceToSegmentKm(
  point,
  segmentStart,
  segmentEnd,
) {
  const referenceLat =
    (
      point.lat +
      segmentStart.lat +
      segmentEnd.lat
    ) / 3;

  const projectedPoint =
    projectPointToKm(
      point,
      referenceLat,
    );

  const projectedStart =
    projectPointToKm(
      segmentStart,
      referenceLat,
    );

  const projectedEnd =
    projectPointToKm(
      segmentEnd,
      referenceLat,
    );

  const segmentX =
    projectedEnd.x -
    projectedStart.x;

  const segmentY =
    projectedEnd.y -
    projectedStart.y;

  const segmentLengthSquared =
    segmentX * segmentX +
    segmentY * segmentY;

  if (
    segmentLengthSquared === 0
  ) {
    return haversineDistanceKm(
      point,
      segmentStart,
    );
  }

  const pointX =
    projectedPoint.x -
    projectedStart.x;

  const pointY =
    projectedPoint.y -
    projectedStart.y;

  const projection =
    (
      pointX * segmentX +
      pointY * segmentY
    ) /
    segmentLengthSquared;

  const clampedProjection =
    Math.max(
      0,
      Math.min(
        1,
        projection,
      ),
    );

  const closestPoint = {
    x:
      projectedStart.x +
      clampedProjection *
        segmentX,

    y:
      projectedStart.y +
      clampedProjection *
        segmentY,
  };

  const distanceX =
    projectedPoint.x -
    closestPoint.x;

  const distanceY =
    projectedPoint.y -
    closestPoint.y;

  return Math.sqrt(
    distanceX * distanceX +
    distanceY * distanceY,
  );
}

function getMinimumDistanceToRouteKm(
  placeLocation,
  routeCoordinates,
) {
  if (
    !placeLocation ||
    routeCoordinates.length === 0
  ) {
    return null;
  }

  if (
    routeCoordinates.length === 1
  ) {
    return haversineDistanceKm(
      placeLocation,
      routeCoordinates[0],
    );
  }

  let minimumDistance =
    Number.POSITIVE_INFINITY;

  for (
    let index = 0;
    index <
    routeCoordinates.length - 1;
    index += 1
  ) {
    const segmentDistance =
      getDistanceToSegmentKm(
        placeLocation,
        routeCoordinates[index],
        routeCoordinates[
          index + 1
        ],
      );

    if (
      segmentDistance <
      minimumDistance
    ) {
      minimumDistance =
        segmentDistance;
    }

    if (
      minimumDistance <= 0.02
    ) {
      break;
    }
  }

  return Number.isFinite(
    minimumDistance,
  )
    ? minimumDistance
    : null;
}

function normalizeStringArray(value) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .map((item) => {
      if (
        typeof item === "string"
      ) {
        return item.trim();
      }

      if (
        item &&
        typeof item === "object"
      ) {
        return cleanText(
          item.id ||
            item.key ||
            item.value ||
            item.tagId ||
            item.subtagId ||
            item.approachId ||
            item.profileId,
        );
      }

      return "";
    })
    .filter(Boolean);
}

function addRecommendationKey(
  keys,
  value,
) {
  const normalizedValue =
    normalizeRecommendationKey(
      value,
    );

  if (normalizedValue) {
    keys.add(
      normalizedValue,
    );
  }
}

function addRecommendationArray(
  keys,
  values,
) {
  normalizeStringArray(
    values,
  ).forEach((value) => {
    addRecommendationKey(
      keys,
      value,
    );
  });
}

function addWeightedKeys(
  keys,
  weightedObject,
) {
  if (
    !weightedObject ||
    typeof weightedObject !==
      "object" ||
    Array.isArray(
      weightedObject,
    )
  ) {
    return;
  }

  Object.entries(
    weightedObject,
  ).forEach(
    ([key, score]) => {
      const numericScore =
        Number(score);

      if (
        Number.isFinite(
          numericScore,
        ) &&
        numericScore > 0
      ) {
        addRecommendationKey(
          keys,
          key,
        );
      }
    },
  );
}

/*
 * Lee estructuras anidadas del perfil.
 *
 * Funciona aunque los puntajes estén
 * guardados en mapas internos.
 */
function collectKeysFromObject(
  keys,
  source,
  depth = 0,
) {
  if (
    !source ||
    typeof source !==
      "object" ||
    depth > 8
  ) {
    return;
  }

  if (Array.isArray(source)) {
    source.forEach((item) => {
      if (
        typeof item === "string"
      ) {
        addRecommendationKey(
          keys,
          item,
        );

        return;
      }

      collectKeysFromObject(
        keys,
        item,
        depth + 1,
      );
    });

    return;
  }

  const directValueFields = [
    "profile",
    "profileId",
    "primaryProfile",
    "subprofile",
    "subProfile",
    "subprofileId",
    "tagId",
    "subtagId",
    "approachId",
    "categoryId",
    "id",
    "key",
    "value",
  ];

  directValueFields.forEach(
    (field) => {
      addRecommendationKey(
        keys,
        source[field],
      );
    },
  );

  const arrayFields = [
    "profiles",
    "subprofiles",
    "subProfiles",
    "tags",
    "preferredTags",
    "subtags",
    "preferredSubtags",
    "approaches",
    "preferredApproaches",
    "categories",
  ];

  arrayFields.forEach(
    (field) => {
      addRecommendationArray(
        keys,
        source[field],
      );
    },
  );

  const weightedFields = [
    "weights",
    "scores",
    "recommendationWeights",
    "recommendationScores",
    "tagScores",
    "subtagScores",
    "approachScores",
    "profileScores",
    "subprofileScores",
  ];

  weightedFields.forEach(
    (field) => {
      addWeightedKeys(
        keys,
        source[field],
      );
    },
  );

  Object.entries(
    source,
  ).forEach(
    ([field, value]) => {
      const normalizedField =
        String(
          field,
        ).toLowerCase();

      /*
       * También reconoce mapas cuyos
       * nombres incluyan score o weight.
       */
      if (
        value &&
        typeof value ===
          "object" &&
        !Array.isArray(value) &&
        (
          normalizedField.includes(
            "score",
          ) ||
          normalizedField.includes(
            "weight",
          )
        )
      ) {
        addWeightedKeys(
          keys,
          value,
        );
      }

      if (
        value &&
        typeof value ===
          "object"
      ) {
        collectKeysFromObject(
          keys,
          value,
          depth + 1,
        );
      }
    },
  );
}

function collectUserRecommendationKeys({
  user,
  profileDocuments,
}) {
  const keys =
    new Set();

  collectKeysFromObject(
    keys,
    user,
  );

  profileDocuments.forEach(
    (profileDocument) => {
      addRecommendationKey(
        keys,
        profileDocument.id,
      );

      collectKeysFromObject(
        keys,
        profileDocument,
      );
    },
  );

  return keys;
}

function getPlaceRecommendationKeys(
  place,
) {
  const keys =
    new Set();

  addRecommendationKey(
    keys,
    place.tagId,
  );

  addRecommendationKey(
    keys,
    place.tagLabel,
  );

  addRecommendationArray(
    keys,
    place.subtags,
  );

  addRecommendationArray(
    keys,
    place.approaches,
  );

  addRecommendationArray(
    keys,
    place.tags,
  );

  return keys;
}

function getRecommendationMatch(
  place,
  userRecommendationKeys,
) {
  const placeKeys =
    getPlaceRecommendationKeys(
      place,
    );

  const matchedKeys = [];

  placeKeys.forEach(
    (placeKey) => {
      const normalizedPlaceKey =
        normalizeRecommendationKey(
          placeKey,
        );

      if (
        normalizedPlaceKey &&
        userRecommendationKeys.has(
          normalizedPlaceKey,
        )
      ) {
        matchedKeys.push(
          normalizedPlaceKey,
        );
      }
    },
  );

  return {
    matches:
      matchedKeys.length > 0,

    matchedKeys:
      [
        ...new Set(
          matchedKeys,
        ),
      ],
  };
}


function getPlacePhotoUrl(place) {
  return (
    cleanText(
      place?.mainPhoto
        ?.thumbnail?.url,
    ) ||
    cleanText(
      place?.mainPhoto
        ?.thumbnailUrl,
    ) ||
    cleanText(
      place?.mainPhoto
        ?.medium?.url,
    ) ||
    cleanText(
      place?.mainPhoto
        ?.mediumUrl,
    ) ||
    cleanText(
      place?.mainPhoto
        ?.url,
    ) ||
    null
  );
}

async function getRecommendationProfileDocuments(
  uid,
) {
  const snapshot =
    await db
      .collection("user")
      .doc(uid)
      .collection(
        "recommendationProfile",
      )
      .get();

  return snapshot.docs.map(
    (document) => ({
      id:
        document.id,

      ...document.data(),
    }),
  );
}

export default async function getRouteRecommendedPlacesService({
  uid,
  encodedPolyline,
  destinationPlaceId,
  maxDistanceKm =
    MAX_ROUTE_DISTANCE_KM,
}) {
  const cleanUid =
    cleanText(uid);

  const cleanDestinationPlaceId =
    cleanText(
      destinationPlaceId,
    );

  const parsedMaxDistanceKm =
    toNumber(
      maxDistanceKm,
    );

  const effectiveMaxDistanceKm =
    parsedMaxDistanceKm !== null &&
    parsedMaxDistanceKm > 0
      ? Math.min(
          parsedMaxDistanceKm,
          MAX_ROUTE_DISTANCE_KM,
        )
      : MAX_ROUTE_DISTANCE_KM;

  if (
    !cleanUid ||
    !encodedPolyline
  ) {
    console.log(
      "[ROUTE RECOMMENDATIONS SKIPPED]",
      {
        cleanUid,
        hasPolyline:
          Boolean(
            encodedPolyline,
          ),
      },
    );

    return [];
  }

  const routeCoordinates =
    decodePolyline(
      encodedPolyline,
    );

  if (
    routeCoordinates.length < 2
  ) {
    console.log(
      "[ROUTE RECOMMENDATIONS INVALID POLYLINE]",
      {
        points:
          routeCoordinates.length,
      },
    );

    return [];
  }

  const userDoc =
    await db
      .collection("user")
      .doc(cleanUid)
      .get();

  if (!userDoc.exists) {
    console.log(
      "[ROUTE RECOMMENDATIONS USER NOT FOUND]",
      {
        uid:
          cleanUid,
      },
    );

    return [];
  }

  const user =
    userDoc.data();

  const profileDocuments =
    await getRecommendationProfileDocuments(
      cleanUid,
    );

  const userRecommendationKeys =
    collectUserRecommendationKeys({
      user,
      profileDocuments,
    });

  console.log(
    "[ROUTE USER PROFILE]",
    {
      uid:
        cleanUid,

      profileDocumentsCount:
        profileDocuments.length,

      profileDocuments,

      recommendationKeys: [
        ...userRecommendationKeys,
      ],
    },
  );

  if (
    userRecommendationKeys.size === 0
  ) {
    console.log(
      "[ROUTE RECOMMENDATIONS WITHOUT PROFILE]",
      {
        uid:
          cleanUid,
      },
    );

    return [];
  }

  const placesSnapshot =
    await db
      .collection("places")
      .where(
        "status",
        "==",
        "published",
      )
      .get();

  const recommendations = [];

  const debugCounters = {
    published:
      placesSnapshot.size,

    destination:
      0,

    deleted:
      0,

    hidden:
      0,

    withoutLocation:
      0,

    withoutMatch:
      0,

    outsideRoute:
      0,

    accepted:
      0,
  };

  placesSnapshot.docs.forEach(
    (placeDoc) => {
      const place =
        placeDoc.data();

      const normalizedPlaceId =
        cleanText(
          place.placeId,
        ) ||
        placeDoc.id;

      if (
        placeDoc.id ===
          cleanDestinationPlaceId ||
        normalizedPlaceId ===
          cleanDestinationPlaceId
      ) {
        debugCounters.destination +=
          1;

        return;
      }

      if (place.deletedAt) {
        debugCounters.deleted +=
          1;

        return;
      }

      const activityStatus =
        cleanText(
          place.activityStatus,
        ).toLowerCase();

      const moderationStatus =
        cleanText(
          place.moderationStatus,
        ).toLowerCase();

      if (
        activityStatus ===
          "inactive" ||
        moderationStatus ===
          "inactive" ||
        moderationStatus ===
          "hidden"
      ) {
        debugCounters.hidden +=
          1;

        return;
      }

      const lat =
        toNumber(
          place?.location?.lat,
        );

      const lng =
        toNumber(
          place?.location?.lng,
        );

      if (
        lat === null ||
        lng === null
      ) {
        debugCounters.withoutLocation +=
          1;

        return;
      }

      const recommendationMatch =
        getRecommendationMatch(
          place,
          userRecommendationKeys,
        );

      if (
        !recommendationMatch.matches
      ) {
        debugCounters.withoutMatch +=
          1;

        return;
      }

      console.log(
  "[ROUTE PLACE MATCH]",
  {
    placeId:
      normalizedPlaceId,

    name:
      place.name,

    tagId:
      place.tagId,

    subtags:
      place.subtags,

    approaches:
      place.approaches,

    matchedBy:
      recommendationMatch
        .matchedKeys,
  },
);

      const distanceToRouteKm =
        getMinimumDistanceToRouteKm(
          {
            lat,
            lng,
          },
          routeCoordinates,
        );

      if (
        distanceToRouteKm === null ||
        distanceToRouteKm >
          effectiveMaxDistanceKm
      ) {
        debugCounters.outsideRoute +=
          1;

        return;
      }

      debugCounters.accepted +=
        1;

      recommendations.push({
        placeId:
          normalizedPlaceId,

        name:
          cleanText(
            place.name,
          ) ||
          "Lugar recomendado",

        address:
          cleanText(
            place.address,
          ),

        location: {
          lat,
          lng,
        },

        tagId:
          cleanText(
            place.tagId,
          ),

        tagLabel:
          cleanText(
            place.tagLabel,
          ),

        subtags:
          normalizeStringArray(
            place.subtags,
          ),

        approaches:
          normalizeStringArray(
            place.approaches,
          ),

        photoUrl:
          getPlacePhotoUrl(
            place,
          ),

        distanceToRouteKm:
          Number(
            distanceToRouteKm.toFixed(
              2,
            ),
          ),

        matchedBy:
          recommendationMatch
            .matchedKeys,
      });
    },
  );

  const finalRecommendations =
    recommendations
      .sort(
        (
          firstPlace,
          secondPlace,
        ) =>
          firstPlace
            .distanceToRouteKm -
          secondPlace
            .distanceToRouteKm,
      )
      .slice(
        0,
        MAX_RECOMMENDATIONS,
      );

  console.log(
    "[ROUTE RECOMMENDATIONS RESULT]",
    {
      uid:
        cleanUid,

      maxDistanceKm:
        effectiveMaxDistanceKm,

      counters:
        debugCounters,

      returned:
        finalRecommendations.length,

      recommendations:
        finalRecommendations.map(
          (place) => ({
            placeId:
              place.placeId,

            name:
              place.name,

            distanceToRouteKm:
              place.distanceToRouteKm,

            matchedBy:
              place.matchedBy,
          }),
        ),
    },
  );

  return finalRecommendations;
}