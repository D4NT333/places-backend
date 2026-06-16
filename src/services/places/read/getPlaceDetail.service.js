import { db } from "../../../config/firebase.js";

const SUBTAGS_COLLECTION = "subtag";
const TAGS_COLLECTION = "tag";

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumberOrNull(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function toNumberOrZero(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function buildPhotoUrl(
  baseUrl,
  reference
) {
  const cleanReference =
    cleanText(reference);

  if (!cleanReference) {
    return null;
  }

  const normalizedBaseUrl =
    cleanText(baseUrl).replace(
      /\/+$/,
      ""
    );

  return `${normalizedBaseUrl}/api/places/photos/google?reference=${encodeURIComponent(
    cleanReference
  )}`;
}

function getDirectPhotoUrl(photo) {
  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return null;
  }

  return (
    cleanText(photo?.medium?.url) ||
    cleanText(photo?.url) ||
    cleanText(photo?.thumbnail?.url) ||
    cleanText(photo?.original?.url) ||
    null
  );
}

function getPhotoWidth(photo) {
  return toNumberOrNull(
    photo?.widthPx ??
      photo?.medium?.width ??
      photo?.original?.width ??
      photo?.thumbnail?.width
  );
}

function getPhotoHeight(photo) {
  return toNumberOrNull(
    photo?.heightPx ??
      photo?.medium?.height ??
      photo?.original?.height ??
      photo?.thumbnail?.height
  );
}

function normalizePhoto(
  photo,
  baseUrl,
  fallbackOrder = 0
) {
  if (
    !photo ||
    typeof photo !== "object"
  ) {
    return null;
  }

  const reference =
    cleanText(photo.reference);

  const directUrl =
    getDirectPhotoUrl(photo);

  const url =
    directUrl ||
    buildPhotoUrl(
      baseUrl,
      reference
    );

  if (!url) {
    return null;
  }

  const source =
    cleanText(photo.source) ||
    (reference
      ? "google"
      : "user");

  const parsedOrder = Number(
    photo.order
  );

  const order = Number.isFinite(
    parsedOrder
  )
    ? parsedOrder
    : fallbackOrder;

  const photoId =
    cleanText(photo.photoId);

  return {
    id:
      photoId ||
      reference ||
      `${source}-photo-${fallbackOrder}`,

    source,

    reference:
      reference || null,

    url,

    widthPx:
      getPhotoWidth(photo),

    heightPx:
      getPhotoHeight(photo),

    order,
  };
}

function normalizePhotos(
  photos,
  mainPhoto,
  baseUrl
) {
  const sourcePhotos =
    Array.isArray(photos)
      ? photos
      : [];

  /*
   * Incluimos mainPhoto porque algunos lugares
   * podrían tenerla aunque photos esté vacío.
   *
   * Si mainPhoto también está dentro de photos,
   * posteriormente se elimina el duplicado.
   */
  const candidates = [
    mainPhoto,
    ...sourcePhotos,
  ].filter(Boolean);

  const normalizedPhotos =
    candidates
      .map((photo, index) =>
        normalizePhoto(
          photo,
          baseUrl,
          index
        )
      )
      .filter(Boolean);

  const uniquePhotos = [];
  const usedPhotoKeys = new Set();

  normalizedPhotos.forEach(
    (photo) => {
      const uniqueKey =
        photo.reference ||
        photo.url ||
        photo.id;

      if (
        usedPhotoKeys.has(uniqueKey)
      ) {
        return;
      }

      usedPhotoKeys.add(uniqueKey);
      uniquePhotos.push(photo);
    }
  );

  return uniquePhotos.sort(
    (firstPhoto, secondPhoto) =>
      firstPhoto.order -
      secondPhoto.order
  );
}

function normalizeReviewDate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function normalizeReviewItem(doc) {
  const review = doc.data();

  return {
    id: doc.id,

    placeId:
      cleanText(review.placeId),

    userId:
      cleanText(review.userId),

    userName:
      cleanText(review.userName) ||
      "Usuario",

    userPhoto:
      cleanText(review.userPhoto) ||
      null,

    rating:
      toNumberOrZero(
        review.rating
      ),

    recommended:
      Boolean(review.recommended),

    hasDetails:
      Boolean(review.hasDetails),

    matchesAnnouncement:
      typeof review.matchesAnnouncement ===
      "boolean"
        ? review.matchesAnnouncement
        : null,

    answers:
      Array.isArray(review.answers)
        ? review.answers
        : [],

    commentText:
      cleanText(
        review.commentText
      ),

    tagId:
      cleanText(review.tagId),

    tagLabel:
      cleanText(review.tagLabel),

    createdAt:
      normalizeReviewDate(
        review.createdAt
      ),
  };
}

async function getCurrentUserReview(
  placeDocId,
  uid
) {
  const cleanUid =
    cleanText(uid);

  if (!cleanUid) {
    return null;
  }

  try {
    const reviewDoc = await db
      .collection("placeReviews")
      .doc(
        `${placeDocId}_${cleanUid}`
      )
      .get();

    if (!reviewDoc.exists) {
      return null;
    }

    const review =
      reviewDoc.data();

    if (review.deletedAt) {
      return null;
    }

    if (
      cleanText(review.status) !==
      "published"
    ) {
      return null;
    }

    return normalizeReviewItem(
      reviewDoc
    );
  } catch (error) {
    console.error(
      "Error obteniendo reseña del usuario actual:",
      error
    );

    return null;
  }
}

async function getCurrentUserDescriptionSubmission(
  placeDocId,
  uid
) {
  const cleanUid =
    cleanText(uid);

  const cleanPlaceId =
    cleanText(placeDocId);

  if (
    !cleanUid ||
    !cleanPlaceId
  ) {
    return null;
  }

  try {
    const snapshot = await db
      .collection(
        "descriptionSubmissions"
      )
      .where(
        "createdBy.uid",
        "==",
        cleanUid
      )
      .where(
        "placeId",
        "==",
        cleanPlaceId
      )
      .where(
        "type",
        "==",
        "description"
      )
      .where(
        "status",
        "==",
        "in_review"
      )
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc =
      snapshot.docs[0];

    const data =
      doc.data();

    if (data.deletedAt) {
      return null;
    }

    return {
      id: doc.id,

      submissionId:
        data.submissionId ||
        doc.id,

      status:
        cleanText(data.status) ||
        "in_review",

      type:
        cleanText(data.type) ||
        "description",
    };
  } catch (error) {
    console.error(
      "Error obteniendo propuesta de descripción en revisión:",
      error
    );

    return null;
  }
}

async function getRecentLsearchReviews(
  placeDocId,
  options = {}
) {
  const cleanPlaceId =
    cleanText(placeDocId);

  const excludeUserId =
    cleanText(
      options.excludeUserId
    );

  const limit =
    Number(options.limit) || 3;

  if (!cleanPlaceId) {
    return [];
  }

  try {
    const snapshot = await db
      .collection("placeReviews")
      .where(
        "placeId",
        "==",
        cleanPlaceId
      )
      .orderBy(
        "createdAt",
        "desc"
      )
      .limit(limit + 5)
      .get();

    return snapshot.docs
      .map(normalizeReviewItem)
      .filter(
        (review) =>
          review.rating > 0
      )
      .filter(
        (review) =>
          cleanText(
            review.userId
          ) !== excludeUserId
      )
      .slice(0, limit);
  } catch (error) {
    console.error(
      "Error obteniendo reseñas internas:",
      error
    );

    return [];
  }
}

async function getTagLabelById(
  tagId,
  fallbackLabel = ""
) {
  const cleanTagId =
    cleanText(tagId);

  const cleanFallbackLabel =
    cleanText(fallbackLabel);

  if (!cleanTagId) {
    return cleanFallbackLabel;
  }

  try {
    const tagDoc = await db
      .collection(
        TAGS_COLLECTION
      )
      .doc(cleanTagId)
      .get();

    if (!tagDoc.exists) {
      return (
        cleanFallbackLabel ||
        cleanTagId
      );
    }

    const tag =
      tagDoc.data();

    return (
      cleanText(tag.label) ||
      cleanText(tag.name) ||
      cleanText(tag.title) ||
      cleanFallbackLabel ||
      cleanTagId
    );
  } catch (error) {
    console.error(
      "Error obteniendo label de tag:",
      error
    );

    return (
      cleanFallbackLabel ||
      cleanTagId
    );
  }
}

async function getSubtagLabelById(
  subtagId
) {
  const cleanSubtagId =
    cleanText(subtagId);

  if (!cleanSubtagId) {
    return "";
  }

  try {
    const subtagDoc = await db
      .collection(
        SUBTAGS_COLLECTION
      )
      .doc(cleanSubtagId)
      .get();

    if (!subtagDoc.exists) {
      return cleanSubtagId;
    }

    const subtag =
      subtagDoc.data();

    return (
      cleanText(subtag.label) ||
      cleanText(subtag.name) ||
      cleanText(subtag.title) ||
      cleanSubtagId
    );
  } catch (error) {
    console.error(
      "Error obteniendo label de subtag:",
      error
    );

    return cleanSubtagId;
  }
}

async function normalizeSubtagsWithLabels(
  subtags
) {
  const cleanSubtags =
    normalizeStringArray(
      subtags
    );

  if (
    cleanSubtags.length === 0
  ) {
    return [];
  }

  const labels =
    await Promise.all(
      cleanSubtags.map(
        (subtagId) =>
          getSubtagLabelById(
            subtagId
          )
      )
    );

  return labels
    .map(cleanText)
    .filter(Boolean);
}

function normalizeGoogleRating(
  place
) {
  const googleRating =
    place?.googleData?.rating;

  if (
    Number.isFinite(
      Number(googleRating)
    ) &&
    Number(googleRating) > 0
  ) {
    return Number(
      googleRating
    );
  }

  return 0;
}

function normalizeLsearchRating(
  place
) {
  const averageRating =
    place?.metrics
      ?.averageRating;

  if (
    Number.isFinite(
      Number(averageRating)
    ) &&
    Number(averageRating) > 0
  ) {
    return Number(
      averageRating
    );
  }

  return 0;
}

function normalizeLocation(
  location
) {
  return {
    lat: Number.isFinite(
      Number(location?.lat)
    )
      ? Number(location.lat)
      : null,

    lng: Number.isFinite(
      Number(location?.lng)
    )
      ? Number(location.lng)
      : null,
  };
}

async function findPlaceDocById(
  placeId
) {
  const cleanPlaceId =
    cleanText(placeId);

  if (!cleanPlaceId) {
    return null;
  }

  const directDoc = await db
    .collection("places")
    .doc(cleanPlaceId)
    .get();

  if (directDoc.exists) {
    return directDoc;
  }

  const byPlaceIdSnapshot =
    await db
      .collection("places")
      .where(
        "placeId",
        "==",
        cleanPlaceId
      )
      .limit(1)
      .get();

  if (
    !byPlaceIdSnapshot.empty
  ) {
    return (
      byPlaceIdSnapshot.docs[0]
    );
  }

  return null;
}

function normalizeRecommendationPercent(
  place
) {
  const metrics =
    place?.metrics || {};

  const recommendationRate =
    Number(
      metrics.recommendationRate
    );

  if (
    Number.isFinite(
      recommendationRate
    ) &&
    recommendationRate > 0
  ) {
    return Math.round(
      recommendationRate * 100
    );
  }

  const recommendationsCount =
    Number(
      metrics.recommendationsCount
    ) || 0;

  const recommendationsPositiveCount =
    Number(
      metrics.recommendationsPositiveCount
    ) || 0;

  if (
    recommendationsCount <= 0
  ) {
    return 0;
  }

  return Math.round(
    (
      recommendationsPositiveCount /
      recommendationsCount
    ) * 100
  );
}

export default async function getPlaceDetailService({
  placeId,
  baseUrl,
  uid,
}) {
  const placeDoc =
    await findPlaceDocById(
      placeId
    );

  if (!placeDoc) {
    const error = new Error(
      "No se encontró el lugar solicitado."
    );

    error.statusCode = 404;

    throw error;
  }

  const place =
    placeDoc.data();

  if (place.deletedAt) {
    const error = new Error(
      "El lugar ya no está disponible."
    );

    error.statusCode = 404;

    throw error;
  }

  if (
    cleanText(place.status) !==
    "published"
  ) {
    const error = new Error(
      "El lugar no está publicado."
    );

    error.statusCode = 404;

    throw error;
  }

  const subtagsWithLabels =
    await normalizeSubtagsWithLabels(
      place.subtags
    );

  const tagId =
    cleanText(place.tagId);

  const tagLabel =
    await getTagLabelById(
      tagId,
      place.tagLabel
    );

  const tags = [
    tagLabel,
    ...subtagsWithLabels,
  ].filter(Boolean);

  const googleRating =
    normalizeGoogleRating(
      place
    );

  const lsearchRating =
    normalizeLsearchRating(
      place
    );

  const googleUserRatingCount =
    toNumberOrZero(
      place?.googleData
        ?.userRatingCount
    );

  const lsearchRatingsCount =
    toNumberOrZero(
      place?.metrics
        ?.ratingsCount
    );

  const commentsCount =
    toNumberOrZero(
      place?.metrics
        ?.commentsCount
    );

  /*
   * Aquí ya se normalizan juntas:
   *
   * - Fotos de Firebase:
   *   medium.url / url / thumbnail.url / original.url
   *
   * - Fotos de Google:
   *   reference
   */
  const images =
    normalizePhotos(
      place.photos,
      place.mainPhoto,
      baseUrl
    );

  const currentUserReview =
    await getCurrentUserReview(
      placeDoc.id,
      uid
    );

  const hasCurrentUserReview =
    Boolean(
      currentUserReview
    );

  const currentUserDescriptionSubmission =
    await getCurrentUserDescriptionSubmission(
      placeDoc.id,
      uid
    );

  const hasCurrentUserDescriptionInReview =
    Boolean(
      currentUserDescriptionSubmission
    );

  const recentLsearchReviews =
    await getRecentLsearchReviews(
      placeDoc.id,
      {
        excludeUserId: uid,
        limit: 3,
      }
    );

  const lsearchReviews =
    currentUserReview
      ? [
          currentUserReview,
          ...recentLsearchReviews,
        ]
      : recentLsearchReviews;

  const recommendsPercent =
    normalizeRecommendationPercent(
      place
    );

  return {
    place: {
      id: placeDoc.id,

      placeId:
        cleanText(
          place.placeId
        ) || placeDoc.id,

      name:
        cleanText(place.name),

      description:
        cleanText(
          place.description
        ),

      address:
        cleanText(
          place.address
        ),

      location:
        normalizeLocation(
          place.location
        ),

      isOpen:
        Boolean(
          place.openingHours
            ?.isOpenNow
        ),

      openingHoursLabel:
        cleanText(
          place.openingHours
            ?.label
        ),

      images,

      googleRating,
      lsearchRating,

      tags,

      tagId,
      tagLabel,

      subtags:
        subtagsWithLabels,

      approaches:
        normalizeStringArray(
          place.approaches
        ),

      googleMapsUri:
        cleanText(
          place?.googleData
            ?.googleMapsUri
        ),

      currentUserReview,

      hasCurrentUserReview,

      canAddReview:
        !hasCurrentUserReview,

      currentUserDescriptionSubmission,

      hasCurrentUserDescriptionInReview,

      canSubmitDescription:
        !hasCurrentUserDescriptionInReview,

      lsearchSummary: {
        averageRating:
          lsearchRating,

        ratingsCount:
          lsearchRatingsCount,

        commentsCount,

        recommendsPercent,
      },

      googleSummary: {
        averageRating:
          googleRating,

        ratingsCount:
          googleUserRatingCount,
      },

      metrics: {
        viewsCount:
          toNumberOrZero(
            place?.metrics
              ?.viewsCount
          ),

        likesCount:
          toNumberOrZero(
            place?.metrics
              ?.likesCount
          ),

        savesCount:
          toNumberOrZero(
            place?.metrics
              ?.savesCount
          ),

        sharesCount:
          toNumberOrZero(
            place?.metrics
              ?.sharesCount
          ),

        commentsCount,

        ratingsCount:
          lsearchRatingsCount,
      },
    },

    lsearchReviews,

    googleReviews: [],
  };
}