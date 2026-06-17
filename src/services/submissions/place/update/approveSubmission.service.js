import { db } from "../../../../config/firebase.js";
import admin from "firebase-admin";

const PLACE_SUBMISSIONS_COLLECTION = "placeSubmissions";
const PLACES_COLLECTION = "places";

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLocation(location) {
  const lat = location?.lat ?? location?.latitude;
  const lng = location?.lng ?? location?.longitude;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function normalizePhoto(photo, index, submissionId, uploadedBy) {
  const mediumUrl = cleanString(photo?.medium?.url || photo?.mediumUrl);
  const thumbnailUrl = cleanString(photo?.thumbnail?.url || photo?.thumbnailUrl);
  const originalUrl = cleanString(photo?.original?.url || photo?.originalUrl);

  return {
    ...photo,

    photoId: cleanString(photo?.photoId) || `photo_${index + 1}`,
    order: index,
    source: "user",
    sourceSubmissionId: submissionId,
    uploadedBy,

    url: mediumUrl || originalUrl || thumbnailUrl,
    path: cleanString(photo?.medium?.path || photo?.path),

    widthPx:
      photo?.medium?.width ??
      photo?.widthPx ??
      null,

    heightPx:
      photo?.medium?.height ??
      photo?.heightPx ??
      null,
  };
}

function buildMetrics() {
  return {
    viewsCount: 0,
    likesCount: 0,
    savesCount: 0,
    sharesCount: 0,
    commentsCount: 0,

    ratingsCount: 0,
    ratingSum: 0,
    averageRating: 0,
    internalRating: 0,
    ratingConfidence: 0,

    reportsCount: 0,
    descriptionProposalsCount: 0,
    photoProposalsCount: 0,
  };
}

function buildTrend() {
  return {
    score: 0,
    weeklyViews: 0,
    weeklyLikes: 0,
    weeklySaves: 0,
    weeklyPhotos: 0,
    weeklyReviews: 0,
    weeklyRatingAverage: 0,
    periodStart: null,
    periodEnd: null,
    calculatedAt: null,
  };
}

export default async function approvePlaceSubmissionService({
  submissionId,
  approvedBy,
}) {
  if (!submissionId) {
    throw createServiceError("Falta el id de la propuesta.", 400);
  }

  const submissionRef = db
    .collection(PLACE_SUBMISSIONS_COLLECTION)
    .doc(submissionId);

  return db.runTransaction(async (transaction) => {
    const submissionSnap = await transaction.get(submissionRef);

    if (!submissionSnap.exists) {
      throw createServiceError("La propuesta no existe.", 404);
    }

    const submission = submissionSnap.data();

    if (!["pending", "in_review", "resubmitted"].includes(submission.status)) {
      throw createServiceError(
        "Esta propuesta ya fue procesada.",
        409
      );
    }

    const location = normalizeLocation(submission.location);

    if (!location) {
      throw createServiceError("La ubicación de la propuesta no es válida.", 400);
    }

    const photos = Array.isArray(submission.photos)
      ? submission.photos.map((photo, index) =>
          normalizePhoto(
            photo,
            index,
            submission.placeSubmissionId || submissionId,
            submission.createdBy
          )
        )
      : [];

    if (photos.length < 1) {
      throw createServiceError("La propuesta no tiene fotos válidas.", 400);
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const placeRef = db.collection(PLACES_COLLECTION).doc();

    const mainPhoto = {
      ...photos[0],
      approvedAt: new Date().toISOString(),
    };

    const placeData = {
      placeId: placeRef.id,

      name: cleanString(submission.name),
      description: cleanString(submission.description),
      address: cleanString(submission.address),

      location,

      tagId: cleanString(submission.tagId),
      tagLabel: cleanString(submission.tagLabel),

      subtags: Array.isArray(submission.subtags)
        ? submission.subtags
        : [],

      approaches: Array.isArray(submission.approaches)
        ? submission.approaches
        : [],

      price: cleanString(submission.price),
      priceRangeId: cleanString(submission.priceRangeId),

      openingHours: submission.openingHours || {
        type: "not_specified",
        label: "Horario no especificado",
        days: [],
        openTime: null,
        closeTime: null,
        isOpenNow: false,
        lastScheduleCheckAt: null,
      },

      photos: photos.map((photo) => ({
        ...photo,
        approvedAt: new Date().toISOString(),
      })),

      mainPhoto,
      photoCount: photos.length,

      metrics: buildMetrics(),
      trend: buildTrend(),

      status: "published",
      source: "mobile",

      createdBy: submission.createdBy || null,
      createdAt: now,
      updatedAt: now,

      deletedAt: null,
      lastInteractionAt: null,

      origin: {
        type: "place_submission",
        submissionId,
        placeSubmissionId:
          submission.placeSubmissionId || submissionId,
        submittedBy: submission.createdBy || null,
        approvedBy: approvedBy || "admin_panel",
        approvedAt: now,
      },
    };

    transaction.set(placeRef, placeData);

    transaction.update(submissionRef, {
      status: "approved",
      approvedAt: now,
      approvedBy: approvedBy || "admin_panel",
      createdPlaceId: placeRef.id,
      updatedAt: now,
    });

    return {
      placeId: placeRef.id,
      submissionId,
      status: "approved",
    };
  });
}