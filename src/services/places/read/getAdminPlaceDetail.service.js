import { db } from "../../../config/firebase.js";

import {
  serializeDate,
} from "../../../utils/firestorePagination.js";

const PRICE_RANGES = {
  r1: {
    id: "r1",
    label: "$",
  },
  r2: {
    id: "r2",
    label: "$$",
  },
  r3: {
    id: "r3",
    label: "$$$",
  },
  r4: {
    id: "r4",
    label: "$$$$",
  },
};

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getDocumentLabel(data, fallbackId) {
  if (!data) {
    return fallbackId;
  }

  return (
    data.label ||
    data.name ||
    data.title ||
    data.displayName ||
    fallbackId
  );
}

function normalizePhoto(photo, index) {
  if (!photo) {
    return null;
  }

  return {
    order: Number.isFinite(Number(photo.order))
      ? Number(photo.order)
      : index,

    source: photo.source || null,
    reference: photo.reference || null,
    url: photo.url || photo.photoURL || null,

    widthPx: Number(photo.widthPx) || null,
    heightPx: Number(photo.heightPx) || null,
  };
}

async function getDocumentById(collectionName, documentId) {
  if (!documentId) {
    return null;
  }

  const snapshot = await db
    .collection(collectionName)
    .doc(documentId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

async function resolveTaxonomyItem(collectionName, id) {
  if (!id) {
    return null;
  }

  const document = await getDocumentById(collectionName, id);

  return {
    id,
    label: getDocumentLabel(document, id),
  };
}

async function resolveTaxonomyList(collectionName, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];

  const values = await Promise.all(
    uniqueIds.map((id) =>
      resolveTaxonomyItem(collectionName, id),
    ),
  );

  return values.filter(Boolean);
}

async function resolveAdmin(adminId) {
  if (!adminId) {
    return null;
  }

  if (
    adminId === "admin_uid_or_system" ||
    adminId === "system"
  ) {
    return {
      uid: adminId,
      name: "Sistema",
      email: null,
      photoURL: null,
    };
  }

  const admin = await getDocumentById(
    "adminUsers",
    adminId,
  );

  if (!admin) {
    return {
      uid: adminId,
      name: adminId,
      email: null,
      photoURL: null,
    };
  }

  return {
    uid: adminId,
    name:
      admin.name ||
      admin.displayName ||
      admin.fullName ||
      admin.email ||
      adminId,

    email: admin.email || null,
    photoURL:
      admin.photoURL ||
      admin.photo ||
      admin.picture ||
      null,
  };
}

export default async function getAdminPlaceDetailService(
  placeId,
) {
  if (!placeId) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  const placeSnapshot = await db
    .collection("places")
    .doc(placeId)
    .get();

  if (!placeSnapshot.exists) {
    throw createHttpError(
      "No se encontró el lugar solicitado.",
      404,
    );
  }

  const place = placeSnapshot.data();

  const [
    category,
    subtags,
    approaches,
    createdBy,
    approvedBy,
  ] = await Promise.all([
    resolveTaxonomyItem("tag", place.tagId),

    resolveTaxonomyList(
      "subtag",
      place.subtags || [],
    ),

    resolveTaxonomyList(
      "approaches",
      place.approaches || [],
    ),

    resolveAdmin(place.createdBy),

    resolveAdmin(place.origin?.approvedBy),
  ]);

  const photos = Array.isArray(place.photos)
    ? place.photos
        .map(normalizePhoto)
        .filter(Boolean)
        .sort((first, second) => {
          return first.order - second.order;
        })
    : [];

  const mainPhoto = place.mainPhoto
    ? normalizePhoto(place.mainPhoto, 0)
    : photos[0] || null;

  const metrics = place.metrics || {};
  const trend = place.trend || {};
  const googleData = place.googleData || {};
  const origin = place.origin || {};
  const openingHours = place.openingHours || {};

  const priceRange =
    PRICE_RANGES[place.priceRangeId] || {
      id: place.priceRangeId || null,
      label: place.priceRangeId || "Sin especificar",
    };

  return {
    place: {
      placeId: place.placeId || placeSnapshot.id,

      name: place.name || "Lugar sin nombre",
      description: place.description || "",
      address: place.address || "",

      location: {
        lat: Number(place.location?.lat) || null,
        lng: Number(place.location?.lng) || null,
      },

      moderationStatus:
        place.status || "pending",

      activityStatus:
        place.activityStatus || "pending",

      category: category || {
        id: place.tagId || null,
        label:
          place.tagLabel ||
          place.tagId ||
          "Sin categoría",
      },

      subtags,
      approaches,
      priceRange,

      openingHours: {
        type: openingHours.type || null,
        label: openingHours.label || "",
        days: Array.isArray(openingHours.days)
          ? openingHours.days
          : [],

        openTime: openingHours.openTime || null,
        closeTime: openingHours.closeTime || null,

        isOpenNow:
          typeof openingHours.isOpenNow === "boolean"
            ? openingHours.isOpenNow
            : null,

        lastScheduleCheckAt: serializeDate(
          openingHours.lastScheduleCheckAt,
        ),
      },

      ratings: {
        google:
          Number(googleData.rating) || 0,

        googleRatingCount:
          Number(googleData.userRatingCount) || 0,

        lsearch:
          Number(metrics.averageRating) ||
          Number(metrics.internalRating) ||
          0,

        lsearchRatingCount:
          Number(metrics.ratingsCount) || 0,

        ratingSum:
          Number(metrics.ratingSum) || 0,

        ratingConfidence:
          Number(metrics.ratingConfidence) || 0,
      },

      metrics: {
        views:
          Number(metrics.viewsCount) || 0,

        likes:
          Number(metrics.likesCount) || 0,

        saves:
          Number(metrics.savesCount) || 0,

        shares:
          Number(metrics.sharesCount) || 0,

        comments:
          Number(metrics.commentsCount) || 0,

        reports:
          Number(metrics.reportsCount) || 0,

        photoProposals:
          Number(metrics.photoProposalsCount) || 0,
      },

      weeklyInteractions: {
        views:
          Number(trend.weeklyViews) || 0,

        likes:
          Number(trend.weeklyLikes) || 0,

        saves:
          Number(trend.weeklySaves) || 0,

        reviews:
          Number(trend.weeklyReviews) || 0,

        photos:
          Number(trend.weeklyPhotos) || 0,

        ratingAverage:
          Number(trend.weeklyRatingAverage) || 0,

        calculatedAt: serializeDate(
          trend.calculatedAt,
        ),

        periodStart: serializeDate(
          trend.periodStart,
        ),

        periodEnd: serializeDate(
          trend.periodEnd,
        ),
      },

      media: {
        photoCount:
          Number(place.photoCount) || photos.length,

        mainPhoto,
        photos,
      },

      google: {
        placeId:
          origin.googlePlaceId || null,

        candidateId:
          origin.candidateId || null,

        mapsUri:
          place.googleMapsUri || null,

        fetchedAt: serializeDate(
          place.googleDataFetchedAt,
        ),
      },

      validation: {
        source:
          origin.type ||
          place.source ||
          "unknown",

        createdBy,
        approvedBy,

        submittedBy:
          origin.submittedBy || null,

        submissionId:
          origin.submissionId || null,

        createdAt: serializeDate(
          place.createdAt,
        ),

        approvedAt: serializeDate(
          origin.approvedAt,
        ),

        updatedAt: serializeDate(
          place.updatedAt,
        ),
      },

      lastInteractionAt: serializeDate(
        place.lastInteractionAt,
      ),

      deletedAt: serializeDate(place.deletedAt),
    },
  };
}