import {
  gridDisk,
  latLngToCell,
} from "h3-js";

import {
  db,
} from "../../../config/firebase.js";

import buildPersonalizedFeedOrderService from "../../recommendations/buildPersonalizedFeedOrder.service.js";

import {
  RECOMMENDATION_PROFILE_DOCUMENT,
} from "../../../config/recommendations/recommendationProfile.config.js";

const DEFAULT_LIMIT =
  100;

const MAX_LIMIT =
  200;

const MINIMUM_POOL_SIZE =
  100;

const INITIAL_RADIUS_KM =
  1;

const MAX_RADIUS_KM =
  5;

const H3_SEARCH_RESOLUTION =
  7;

const H3_SEARCH_RING_SIZE =
  5;

const FIRESTORE_IN_LIMIT =
  30;

const SUBTAGS_COLLECTION =
  "subtag";

const HOME_MAX_SUBTAGS =
  2;

const GOOGLE_FEED_PHOTO_MAX_WIDTH =
  640;

const GOOGLE_THUMBNAIL_MAX_WIDTH =
  240;

const VISIBLE_MODERATION_STATUSES =
  new Set([
    "published",
    "warned",
  ]);

const VISIBLE_ACTIVITY_STATUSES =
  new Set([
    "active",
    "low_activity",
    "pending",
  ]);

function cleanText(
  value,
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function normalizeCoordinate(
  value,
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function normalizeLimit(
  value,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.floor(
      parsed,
    ),
    MAX_LIMIT,
  );
}

function normalizeCursorOffset(
  cursor,
) {
  const parsed =
    Number(cursor);

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.floor(
    parsed,
  );
}

function normalizeStringArray(
  value,
) {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ) =>
        typeof item ===
        "string",
    )
    .map(
      (
        item,
      ) =>
        item.trim(),
    )
    .filter(
      Boolean,
    );
}

function chunkArray(
  values,
  chunkSize,
) {
  const chunks = [];

  for (
    let index = 0;
    index < values.length;
    index += chunkSize
  ) {
    chunks.push(
      values.slice(
        index,
        index +
          chunkSize,
      ),
    );
  }

  return chunks;
}

function calculateDistanceKm({
  userLatitude,
  userLongitude,
  placeLatitude,
  placeLongitude,
}) {
  const earthRadiusKm =
    6371;

  const toRadians =
    (
      degrees,
    ) =>
      (
        degrees *
        Math.PI
      ) /
      180;

  const latitudeDifference =
    toRadians(
      placeLatitude -
        userLatitude,
    );

  const longitudeDifference =
    toRadians(
      placeLongitude -
        userLongitude,
    );

  const firstLatitude =
    toRadians(
      userLatitude,
    );

  const secondLatitude =
    toRadians(
      placeLatitude,
    );

  const haversineValue =
    Math.sin(
      latitudeDifference /
        2,
    ) **
      2 +
    Math.cos(
      firstLatitude,
    ) *
      Math.cos(
        secondLatitude,
      ) *
      Math.sin(
        longitudeDifference /
          2,
      ) **
        2;

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

function getPublicApiUrl() {
  return cleanText(
    process.env
      .PUBLIC_API_URL,
  ).replace(
    /\/+$/,
    "",
  );
}

function buildGooglePhotoProxyUrl({
  reference,
  maxWidthPx,
}) {
  const cleanReference =
    cleanText(
      reference,
    );

  const publicApiUrl =
    getPublicApiUrl();

  if (
    !cleanReference ||
    !publicApiUrl
  ) {
    return "";
  }

  return (
    `${publicApiUrl}/api/places/feed-photo/google` +
    `?reference=${encodeURIComponent(
      cleanReference,
    )}` +
    `&maxWidthPx=${maxWidthPx}`
  );
}

function normalizeMainPhoto(
  mainPhoto,
) {
  if (
    !mainPhoto ||
    typeof mainPhoto !==
      "object"
  ) {
    return null;
  }

  const source =
    cleanText(
      mainPhoto.source,
    );

  const order =
    Number.isFinite(
      Number(
        mainPhoto.order,
      ),
    )
      ? Number(
          mainPhoto.order,
        )
      : 0;

  if (
    source ===
      "google" &&
    cleanText(
      mainPhoto.reference,
    )
  ) {
    const reference =
      cleanText(
        mainPhoto.reference,
      );

    const mediumUrl =
      buildGooglePhotoProxyUrl({
        reference,

        maxWidthPx:
          GOOGLE_FEED_PHOTO_MAX_WIDTH,
      });

    const thumbnailUrl =
      buildGooglePhotoProxyUrl({
        reference,

        maxWidthPx:
          GOOGLE_THUMBNAIL_MAX_WIDTH,
      });

    return {
      source,

      reference,

      order,

      widthPx:
        Number.isFinite(
          Number(
            mainPhoto.widthPx,
          ),
        )
          ? Number(
              mainPhoto.widthPx,
            )
          : null,

      heightPx:
        Number.isFinite(
          Number(
            mainPhoto.heightPx,
          ),
        )
          ? Number(
              mainPhoto.heightPx,
            )
          : null,

      url:
        mediumUrl,

      mediumUrl,

      thumbnailUrl,
    };
  }

  const mediumUrl =
    cleanText(
      mainPhoto?.medium
        ?.url ||
        mainPhoto
          ?.mediumUrl ||
        mainPhoto?.url,
    );

  const thumbnailUrl =
    cleanText(
      mainPhoto?.thumbnail
        ?.url ||
        mainPhoto
          ?.thumbnailUrl,
    );

  return {
    source:
      source ||
      "user",

    order,

    photoId:
      cleanText(
        mainPhoto.photoId,
      ),

    url:
      mediumUrl ||
      thumbnailUrl ||
      "",

    mediumUrl:
      mediumUrl ||
      "",

    thumbnailUrl:
      thumbnailUrl ||
      "",

    widthPx:
      Number.isFinite(
        Number(
          mainPhoto?.medium
            ?.width ??
            mainPhoto?.medium
              ?.widthPx ??
            mainPhoto?.widthPx,
        ),
      )
        ? Number(
            mainPhoto?.medium
              ?.width ??
              mainPhoto?.medium
                ?.widthPx ??
              mainPhoto?.widthPx,
          )
        : null,

    heightPx:
      Number.isFinite(
        Number(
          mainPhoto?.medium
            ?.height ??
            mainPhoto?.medium
              ?.heightPx ??
            mainPhoto?.heightPx,
        ),
      )
        ? Number(
            mainPhoto?.medium
              ?.height ??
              mainPhoto?.medium
                ?.heightPx ??
              mainPhoto?.heightPx,
          )
        : null,
  };
}

function normalizeRating(
  place,
) {
  const googleRating =
    place?.googleData
      ?.rating;

  const averageRating =
    place?.metrics
      ?.averageRating;

  if (
    Number.isFinite(
      Number(
        googleRating,
      ),
    ) &&
    Number(
      googleRating,
    ) >
      0
  ) {
    return Number(
      googleRating,
    );
  }

  if (
    Number.isFinite(
      Number(
        averageRating,
      ),
    ) &&
    Number(
      averageRating,
    ) >
      0
  ) {
    return Number(
      averageRating,
    );
  }

  return null;
}

function normalizeUserRatingCount(
  place,
) {
  const googleCount =
    place?.googleData
      ?.userRatingCount;

  const internalCount =
    place?.metrics
      ?.ratingsCount;

  if (
    Number.isFinite(
      Number(
        googleCount,
      ),
    ) &&
    Number(
      googleCount,
    ) >
      0
  ) {
    return Number(
      googleCount,
    );
  }

  if (
    Number.isFinite(
      Number(
        internalCount,
      ),
    ) &&
    Number(
      internalCount,
    ) >
      0
  ) {
    return Number(
      internalCount,
    );
  }

  return 0;
}

function isVisiblePlace(
  place,
) {
  const status =
    cleanText(
      place?.status,
    );

  const activityStatus =
    cleanText(
      place?.activityStatus,
    );

  const deletedAt =
    place?.deletedAt;

  return (
    VISIBLE_MODERATION_STATUSES.has(
      status,
    ) &&
    VISIBLE_ACTIVITY_STATUSES.has(
      activityStatus,
    ) &&
    (
      deletedAt ===
        null ||
      deletedAt ===
        undefined
    )
  );
}

async function getNearbyPlaceDocuments({
  latitude,
  longitude,
}) {
  const centerHexId =
    latLngToCell(
      latitude,
      longitude,
      H3_SEARCH_RESOLUTION,
    );

  /*
   * Se consultan suficientes celdas H7
   * para cubrir el radio máximo.
   *
   * El filtro exacto de 5 km se realiza
   * después mediante Haversine.
   */
  const nearbyHexIds =
    gridDisk(
      centerHexId,
      H3_SEARCH_RING_SIZE,
    );

  const hexChunks =
    chunkArray(
      nearbyHexIds,
      FIRESTORE_IN_LIMIT,
    );

  const snapshots =
    await Promise.all(
      hexChunks.map(
        (
          hexChunk,
        ) =>
          db
            .collection(
              "places",
            )
            .where(
              "parentHexId",
              "in",
              hexChunk,
            )
            .get(),
      ),
    );

  const documentsById =
    new Map();

  snapshots.forEach(
    (
      snapshot,
    ) => {
      snapshot.docs.forEach(
        (
          document,
        ) => {
          const place =
            document.data();

          if (
            !isVisiblePlace(
              place,
            )
          ) {
            return;
          }

          documentsById.set(
            document.id,
            document,
          );
        },
      );
    },
  );

  return [
    ...documentsById.values(),
  ];
}

function buildDistanceCandidates({
  documents,
  latitude,
  longitude,
}) {
  return documents
    .map(
      (
        document,
      ) => {
        const place =
          document.data();

        const placeLatitude =
          normalizeCoordinate(
            place?.location
              ?.lat,
          );

        const placeLongitude =
          normalizeCoordinate(
            place?.location
              ?.lng,
          );

        if (
          placeLatitude ===
            null ||
          placeLongitude ===
            null
        ) {
          return null;
        }

        const distanceKm =
          calculateDistanceKm({
            userLatitude:
              latitude,

            userLongitude:
              longitude,

            placeLatitude,

            placeLongitude,
          });

        return {
          document,

          distanceKm,
        };
      },
    )
    .filter(
      Boolean,
    )
    .filter(
      (
        candidate,
      ) =>
        candidate.distanceKm <=
        MAX_RADIUS_KM,
    )
    .sort(
      (
        firstCandidate,
        secondCandidate,
      ) =>
        firstCandidate
          .distanceKm -
        secondCandidate
          .distanceKm,
    );
}

function resolveSearchRadius(
  candidates,
) {
  for (
    let radiusKm =
      INITIAL_RADIUS_KM;
    radiusKm <=
    MAX_RADIUS_KM;
    radiusKm += 1
  ) {
    const candidatesInsideRadius =
      candidates.filter(
        (
          candidate,
        ) =>
          candidate.distanceKm <=
          radiusKm,
      );

    if (
      candidatesInsideRadius
        .length >=
      MINIMUM_POOL_SIZE
    ) {
      return {
        radiusUsedKm:
          radiusKm,

        candidates:
          candidatesInsideRadius,
      };
    }
  }

  return {
    radiusUsedKm:
      MAX_RADIUS_KM,

    candidates:
      candidates.filter(
        (
          candidate,
        ) =>
          candidate.distanceKm <=
          MAX_RADIUS_KM,
      ),
  };
}

async function getSubtagLabelsMap(
  subtagIds,
) {
  const uniqueSubtagIds =
    [
      ...new Set(
        normalizeStringArray(
          subtagIds,
        ),
      ),
    ];

  if (
    uniqueSubtagIds.length ===
    0
  ) {
    return new Map();
  }

  const snapshots =
    await Promise.all(
      uniqueSubtagIds.map(
        (
          subtagId,
        ) =>
          db
            .collection(
              SUBTAGS_COLLECTION,
            )
            .doc(
              subtagId,
            )
            .get(),
      ),
    );

  const labelsMap =
    new Map();

  snapshots.forEach(
    (
      snapshot,
      index,
    ) => {
      const subtagId =
        uniqueSubtagIds[
          index
        ];

      if (
        !snapshot.exists
      ) {
        labelsMap.set(
          subtagId,
          subtagId,
        );

        return;
      }

      const data =
        snapshot.data();

      labelsMap.set(
        subtagId,
        cleanText(
          data?.label,
        ) ||
          cleanText(
            data?.name,
          ) ||
          cleanText(
            data?.title,
          ) ||
          subtagId,
      );
    },
  );

  return labelsMap;
}

function normalizeSubtagsWithLabels(
  subtags,
  subtagLabelsMap,
) {
  return normalizeStringArray(
    subtags,
  )
    .map(
      (
        subtagId,
      ) =>
        subtagLabelsMap.get(
          subtagId,
        ) ||
        subtagId,
    )
    .map(
      cleanText,
    )
    .filter(
      Boolean,
    );
}

function buildHomeTags({
  tagLabel,
  subtags,
}) {
  const cleanTagLabel =
    cleanText(
      tagLabel,
    );

  const visibleSubtags =
    Array.isArray(
      subtags,
    )
      ? subtags.slice(
          0,
          HOME_MAX_SUBTAGS,
        )
      : [];

  return [
    cleanTagLabel,
    ...visibleSubtags,
  ]
    .map(
      cleanText,
    )
    .filter(
      Boolean,
    );
}

function mapPlaceForFeed({
  document,
  distanceKm,
  subtagLabelsMap,
}) {
  const place =
    document.data();

  const subtagsWithLabels =
    normalizeSubtagsWithLabels(
      place?.subtags,
      subtagLabelsMap,
    );

  const tagLabel =
    cleanText(
      place?.tagLabel,
    );

  return {
    id:
      document.id,

    placeId:
      cleanText(
        place?.placeId,
      ) ||
      document.id,

    name:
      cleanText(
        place?.name,
      ),

    mainPhoto:
      normalizeMainPhoto(
        place?.mainPhoto,
      ),

    rating:
      normalizeRating(
        place,
      ),

    userRatingCount:
      normalizeUserRatingCount(
        place,
      ),

    tagId:
      cleanText(
        place?.tagId,
      ),

    tagLabel,

    subtags:
      subtagsWithLabels,

    approaches:
      normalizeStringArray(
        place?.approaches,
      ),

    tags:
      buildHomeTags({
        tagLabel,

        subtags:
          subtagsWithLabels,
      }),

    openingHoursLabel:
      cleanText(
        place?.openingHours
          ?.label,
      ),

    isOpenNow:
      Boolean(
        place?.openingHours
          ?.isOpenNow,
      ),

    priceRangeId:
      cleanText(
        place?.priceRangeId,
      ),

    location: {
      lat:
        normalizeCoordinate(
          place?.location
            ?.lat,
        ),

      lng:
        normalizeCoordinate(
          place?.location
            ?.lng,
        ),
    },

    distanceKm:
      Number(
        distanceKm.toFixed(
          3,
        ),
      ),
  };
}

async function getUserRecommendationProfile(
  uid,
) {
  const normalizedUid =
    cleanText(
      uid,
    );

  if (!normalizedUid) {
    return null;
  }

  const profileSnapshot =
    await db
      .collection("user")
      .doc(normalizedUid)
      .collection(
        RECOMMENDATION_PROFILE_DOCUMENT
          .subcollection,
      )
      .doc(
        RECOMMENDATION_PROFILE_DOCUMENT
          .documentId,
      )
      .get();

  if (!profileSnapshot.exists) {
    return null;
  }

  return profileSnapshot.data();
}

function normalizeBoolean(
  value,
) {
  return (
    value === true ||
    value === "true" ||
    value === "1"
  );
}

function normalizeCsvValues(
  value,
) {
  if (
    typeof value !== "string"
  ) {
    return [];
  }

  return value
    .split(",")
    .map(
      (
        item,
      ) =>
        cleanText(
          item,
        ),
    )
    .filter(
      Boolean,
    );
}

function normalizeFilterValue(
  value,
) {
  return cleanText(
    value,
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /&/g,
      " y ",
    )
    .replace(
      /[^a-z0-9]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    )
    .replace(
      /_+/g,
      "_",
    )
    .replace(
      /^subtag_/,
      "",
    )
    .replace(
      /^approach_/,
      "",
    )
    .replace(
      /^tag_/,
      "",
    );
}

function hasAnyFilterMatch(
  placeValues,
  requestedValues,
) {
  if (
    requestedValues.length ===
    0
  ) {
    return true;
  }

  const normalizedPlaceValues =
    new Set(
      normalizeStringArray(
        placeValues,
      )
        .map(
          normalizeFilterValue,
        )
        .filter(
          Boolean,
        ),
    );

  return requestedValues.some(
    (
      requestedValue,
    ) =>
      normalizedPlaceValues.has(
        normalizeFilterValue(
          requestedValue,
        ),
      ),
  );
}

function filterCandidatesByFeedFilters({
  candidates,
  filters,
}) {
  if (
    !filters ||
    typeof filters !== "object"
  ) {
    return candidates;
  }

  const requestedCategory =
    normalizeFilterValue(
      filters.categoryKey,
    );

  const requestedSubtags =
    normalizeCsvValues(
      filters.subtags,
    );

  const requestedApproaches =
    normalizeCsvValues(
      filters.approaches,
    );

  const requestedPriceIndex =
    Number(
      filters.priceIndex,
    );

  const requiresFree =
    normalizeBoolean(
      filters.isFree,
    );

  const requiresOpenNow =
    normalizeBoolean(
      filters.openNow,
    );

  return candidates.filter(
    (
      candidate,
    ) => {
      const place =
        candidate.document.data();

      if (
        requestedCategory &&
        normalizeFilterValue(
          place?.tagId,
        ) !==
          requestedCategory
      ) {
        return false;
      }

      if (
        !hasAnyFilterMatch(
          place?.subtags,
          requestedSubtags,
        )
      ) {
        return false;
      }

      if (
        !hasAnyFilterMatch(
          place?.approaches,
          requestedApproaches,
        )
      ) {
        return false;
      }

      if (requiresFree) {
        const priceId =
          normalizeFilterValue(
            place?.priceRangeId,
          );

        const isFreePlace =
          place?.isFree === true ||
          priceId === "free" ||
          priceId === "gratis" ||
          priceId === "r0";

        if (!isFreePlace) {
          return false;
        }
      } else if (
        Number.isFinite(
          requestedPriceIndex,
        ) &&
        requestedPriceIndex >
          0
      ) {
        const placePriceIndex =
          Number(
            cleanText(
              place?.priceRangeId,
            ).replace(
              /^r/i,
              "",
            ),
          );

        if (
          !Number.isFinite(
            placePriceIndex,
          ) ||
          placePriceIndex >
            requestedPriceIndex
        ) {
          return false;
        }
      }

      if (
        requiresOpenNow &&
        place?.openingHours
          ?.isOpenNow !== true
      ) {
        return false;
      }

      return true;
    },
  );
}

export default async function getPlacesFeedService({
  latitude,
  longitude,
  limit,
  cursor,
  uid,
  filters,
} = {}) {
  const normalizedLatitude =
    normalizeCoordinate(
      latitude,
    );

  const normalizedLongitude =
    normalizeCoordinate(
      longitude,
    );

  if (
    normalizedLatitude ===
      null ||
    normalizedLongitude ===
      null
  ) {
    const error =
      new Error(
        "La ubicación del usuario es obligatoria para generar el feed.",
      );

    error.statusCode =
      400;

    throw error;
  }

  const safeLimit =
    normalizeLimit(
      limit,
    );

  const cursorOffset =
    normalizeCursorOffset(
      cursor,
    );

    const normalizedUid =
  cleanText(
    uid,
  );

if (!normalizedUid) {
  const error =
    new Error(
      "El usuario autenticado es obligatorio para generar el feed.",
    );

  error.statusCode =
    401;

  throw error;
}

  const nearbyDocuments =
    await getNearbyPlaceDocuments({
      latitude:
        normalizedLatitude,

      longitude:
        normalizedLongitude,
    });

  const distanceCandidates =
    buildDistanceCandidates({
      documents:
        nearbyDocuments,

      latitude:
        normalizedLatitude,

      longitude:
        normalizedLongitude,
    });

  const {
    radiusUsedKm,
    candidates:
      candidatesInsideRadius,
  } =
    resolveSearchRadius(
      distanceCandidates,
    );

  const filteredCandidates =
  filterCandidatesByFeedFilters({
    candidates:
      candidatesInsideRadius,

    filters,
  });

const totalAvailable =
  filteredCandidates.length;

const recommendationProfile =
  await getUserRecommendationProfile(
    normalizedUid,
  );

const personalizedCandidates =
  buildPersonalizedFeedOrderService({
    candidates:
      filteredCandidates,

    recommendationProfile,
  });

const selectedCandidates =
  personalizedCandidates.slice(
    cursorOffset,
    cursorOffset +
      safeLimit,
  );

  const selectedDocuments =
    selectedCandidates.map(
      (
        candidate,
      ) =>
        candidate.document,
    );

  const subtagIds =
    selectedDocuments.flatMap(
      (
        document,
      ) =>
        normalizeStringArray(
          document.data()
            ?.subtags,
        ),
    );

  const subtagLabelsMap =
    await getSubtagLabelsMap(
      subtagIds,
    );

  const places =
    selectedCandidates.map(
      (
        candidate,
      ) =>
        mapPlaceForFeed({
          document:
            candidate.document,

          distanceKm:
            candidate.distanceKm,

          subtagLabelsMap,
        }),
    );

  const nextOffset =
    cursorOffset +
    places.length;

  const hasMore =
    nextOffset <
    totalAvailable;

  const insufficientResults =
    radiusUsedKm ===
      MAX_RADIUS_KM &&
    totalAvailable <
      MINIMUM_POOL_SIZE;

  return {
    places,

    nextCursor:
      hasMore
        ? String(
            nextOffset,
          )
        : null,

    hasMore,

    radiusUsedKm,

    totalAvailable,

    insufficientResults,

    personalization: {
  enabled:
    Boolean(
      recommendationProfile
        ?.dominantProfileId &&
      recommendationProfile
        ?.dominantSubprofileId,
    ),

  dominantProfileId:
    recommendationProfile
      ?.dominantProfileId ||
    null,

  dominantSubprofileId:
    recommendationProfile
      ?.dominantSubprofileId ||
    null,
},

    message:
      insufficientResults
        ? "No existen más resultados suficientes en esta zona. Muévete a una zona con mayor cobertura para descubrir más lugares."
        : "",
  };
}