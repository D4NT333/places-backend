import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { db } from "../../../config/firebase.js";

import getPlaceMetricPeriod from "../../../utils/getPlaceMetricPeriod.js";

const COMMENT_MIN_LENGTH = 80;
const COMMENT_MAX_LENGTH = 200;

const PLACE_EVENT_TYPES = {
  REVIEW_CREATED: "place_review_created",
};

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function isBoolean(value) {
  return typeof value === "boolean";
}

function validateRating(value) {
  const rating = toNumber(value);

  if (
    rating === null ||
    rating < 0.5 ||
    rating > 5
  ) {
    throw createHttpError(
      "La calificación debe estar entre 0.5 y 5.",
      400
    );
  }

  if ((rating * 2) % 1 !== 0) {
    throw createHttpError(
      "La calificación solo puede usar incrementos de 0.5.",
      400
    );
  }

  return rating;
}

function validateLikertValue(value, fieldName) {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 5
  ) {
    throw createHttpError(
      `${fieldName} debe ser un número entero entre 1 y 5.`,
      400
    );
  }

  return parsed;
}

function normalizeAnswers(answers) {
  if (
    !Array.isArray(answers) ||
    answers.length !== 2
  ) {
    throw createHttpError(
      "Debes responder exactamente 2 preguntas específicas.",
      400
    );
  }

  return answers.map((answer, index) => {
    const questionId =
      cleanText(answer?.questionId);

    const questionText =
      cleanText(answer?.questionText);

    const label =
      cleanText(answer?.label);

    const value =
      validateLikertValue(
        answer?.value,
        `La respuesta ${index + 1}`
      );

    if (!questionId) {
      throw createHttpError(
        `La pregunta ${index + 1} no tiene identificador.`,
        400
      );
    }

    if (!questionText) {
      throw createHttpError(
        `La pregunta ${index + 1} no tiene texto.`,
        400
      );
    }

    return {
      questionId,
      questionText,
      value,
      label,
    };
  });
}

function validateCommentText(value) {
  const commentText =
    cleanText(value);

  if (
    commentText.length <
    COMMENT_MIN_LENGTH
  ) {
    throw createHttpError(
      `El comentario debe tener al menos ${COMMENT_MIN_LENGTH} caracteres.`,
      400
    );
  }

  if (
    commentText.length >
    COMMENT_MAX_LENGTH
  ) {
    throw createHttpError(
      `El comentario no puede superar ${COMMENT_MAX_LENGTH} caracteres.`,
      400
    );
  }

  return commentText;
}

async function findPlaceRefById(placeId) {
  const cleanPlaceId =
    cleanText(placeId);

  if (!cleanPlaceId) {
    throw createHttpError(
      "El id del lugar es obligatorio.",
      400
    );
  }

  const directRef =
    db
      .collection("places")
      .doc(cleanPlaceId);

  const directDoc =
    await directRef.get();

  if (directDoc.exists) {
    return directRef;
  }

  const snapshot =
    await db
      .collection("places")
      .where(
        "placeId",
        "==",
        cleanPlaceId
      )
      .limit(1)
      .get();

  if (snapshot.empty) {
    throw createHttpError(
      "No se encontró el lugar.",
      404
    );
  }

  return snapshot.docs[0].ref;
}

function buildReviewData({
  body,
  placeDoc,
  placeRef,
  user,
}) {
  const place =
    placeDoc.data();

  if (place.deletedAt) {
    throw createHttpError(
      "Este lugar ya no está disponible.",
      404
    );
  }

  if (
    cleanText(place.status) !==
    "published"
  ) {
    throw createHttpError(
      "Este lugar no está publicado.",
      400
    );
  }

  if (
    !isBoolean(body.recommended)
  ) {
    throw createHttpError(
      "Debes indicar si recomiendas el lugar.",
      400
    );
  }

  const rating =
    validateRating(body.rating);

  const hasDetails =
    Boolean(body.hasDetails);

  let matchesAnnouncement = null;
  let answers = [];
  let commentText = "";

  if (hasDetails) {
    if (
      !isBoolean(
        body.matchesAnnouncement
      )
    ) {
      throw createHttpError(
        "Debes indicar si la experiencia coincide con lo anunciado.",
        400
      );
    }

    matchesAnnouncement =
      body.matchesAnnouncement;

    answers =
      normalizeAnswers(
        body.answers
      );

    commentText =
      validateCommentText(
        body.commentText
      );
  }

  const tagId =
    cleanText(body.tagId) ||
    cleanText(place.tagId);

  const tagLabel =
    cleanText(body.tagLabel) ||
    cleanText(place.tagLabel);

  return {
    placeId:
      placeRef.id,

    placeName:
      cleanText(place.name),

    userId:
      user.uid,

    userName:
      cleanText(user.name),

    userPhoto:
      cleanText(user.picture),

    tagId,
    tagLabel,

    recommended:
      body.recommended,

    rating,

    hasDetails,
    matchesAnnouncement,

    answers,
    commentText,

    status:
      "published",

    reportCount:
      0,

    createdAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),

    deletedAt:
      null,
  };
}

function createInitialWeeklyMetric({
  placeId,
  weekId,
  weekStartId,
  weekEndId,
  dayId,
  now,
}) {
  return {
    placeId,

    weekId,
    weekStartId,
    weekEndId,

    totals: {
      views: 0,

      likesAdded: 0,
      likesRemoved: 0,

      savesAdded: 0,
      savesRemoved: 0,

      shares: 0,

      reviewsCreated: 1,
      reviewsDeleted: 0,

      reportsCreated: 0,

      photoProposalsCreated: 0,
      descriptionProposalsCreated: 0,

      dwellTimeSeconds: 0,
      validSessions: 0,
      averageDwellTimeSeconds: 0,
    },

    days: {
      [dayId]: {
        views: 0,

        likesAdded: 0,
        likesRemoved: 0,

        savesAdded: 0,
        savesRemoved: 0,

        shares: 0,

        reviewsCreated: 1,
        reviewsDeleted: 0,

        reportsCreated: 0,

        photoProposalsCreated: 0,
        descriptionProposalsCreated: 0,

        dwellTimeSeconds: 0,
        validSessions: 0,
        averageDwellTimeSeconds: 0,
      },
    },

    createdAt: now,
    updatedAt: now,
  };
}

export default async function createPlaceReviewService({
  uid,
  user,
  placeId,
  body,
}) {
  if (!uid) {
    throw createHttpError(
      "Usuario no autenticado.",
      401
    );
  }

  const placeRef =
    await findPlaceRefById(
      placeId
    );

  const reviewRef =
    db
      .collection("placeReviews")
      .doc(
        `${placeRef.id}_${uid}`
      );

  const now =
    Timestamp.now();

  const {
    dayId,
    weekId,
    weekStartId,
    weekEndId,
  } = getPlaceMetricPeriod(
    now.toDate()
  );

  const weeklyMetricRef =
    placeRef
      .collection("weeklyMetrics")
      .doc(weekId);

  const interactionStateRef =
    placeRef
      .collection("interactionStates")
      .doc(uid);

  /*
   * Se crea fuera de la transacción para que, si
   * Firestore la reintenta, se conserve el mismo ID.
   */
  const eventRef =
    placeRef
      .collection("events")
      .doc();

  const result =
    await db.runTransaction(
      async (transaction) => {
        /*
         * Todas las lecturas ocurren antes
         * de cualquier escritura.
         */
        const [
          placeDoc,
          existingReviewDoc,
          weeklyMetricDoc,
          interactionStateDoc,
        ] = await Promise.all([
          transaction.get(
            placeRef
          ),

          transaction.get(
            reviewRef
          ),

          transaction.get(
            weeklyMetricRef
          ),

          transaction.get(
            interactionStateRef
          ),
        ]);

        if (!placeDoc.exists) {
          throw createHttpError(
            "No se encontró el lugar.",
            404
          );
        }

        if (
          existingReviewDoc.exists &&
          !existingReviewDoc
            .data()
            ?.deletedAt
        ) {
          throw createHttpError(
            "Ya publicaste una reseña para este lugar.",
            409
          );
        }

        const reviewData =
          buildReviewData({
            body,
            placeDoc,
            placeRef,
            user,
          });

        const place =
          placeDoc.data();

        const metrics =
          place.metrics || {};

        const currentRatingSum =
          Number(
            metrics.ratingSum
          ) || 0;

        const currentRatingsCount =
          Number(
            metrics.ratingsCount
          ) || 0;

        const currentCommentsCount =
          Number(
            metrics.commentsCount
          ) || 0;

        const currentRecommendationsCount =
          Number(
            metrics.recommendationsCount
          ) || 0;

        const currentRecommendationsPositiveCount =
          Number(
            metrics.recommendationsPositiveCount
          ) || 0;

        const nextRatingSum =
          currentRatingSum +
          reviewData.rating;

        const nextRatingsCount =
          currentRatingsCount + 1;

        const nextAverageRating =
          nextRatingSum /
          nextRatingsCount;

        /*
         * commentsCount solamente aumenta si
         * la reseña incluye comentario escrito.
         *
         * reviewsCreated siempre aumenta, sea
         * reseña sencilla o detallada.
         */
        const nextCommentsCount =
          reviewData.commentText
            ? currentCommentsCount + 1
            : currentCommentsCount;

        const nextRecommendationsCount =
          currentRecommendationsCount + 1;

        const nextRecommendationsPositiveCount =
          reviewData.recommended
            ? currentRecommendationsPositiveCount + 1
            : currentRecommendationsPositiveCount;

        const nextRecommendationRate =
          nextRecommendationsCount > 0
            ? nextRecommendationsPositiveCount /
              nextRecommendationsCount
            : 0;

        /*
         * 1. Crear o restaurar la reseña.
         */
        transaction.set(
          reviewRef,
          reviewData
        );

        /*
         * 2. Actualizar métricas históricas
         * del documento principal del lugar.
         */
        transaction.update(
          placeRef,
          {
            "metrics.ratingSum":
              nextRatingSum,

            "metrics.ratingsCount":
              nextRatingsCount,

            "metrics.averageRating":
              nextAverageRating,

            "metrics.internalRating":
              nextAverageRating,

            "metrics.commentsCount":
              nextCommentsCount,

            "metrics.recommendationsCount":
              nextRecommendationsCount,

            "metrics.recommendationsPositiveCount":
              nextRecommendationsPositiveCount,

            "metrics.recommendationRate":
              nextRecommendationRate,

            lastInteractionAt:
              now,

            updatedAt:
              now,
          }
        );

        /*
         * 3. Actualizar la métrica semanal.
         */
        if (weeklyMetricDoc.exists) {
          transaction.update(
            weeklyMetricRef,
            {
              "totals.reviewsCreated":
                FieldValue.increment(1),

              [`days.${dayId}.reviewsCreated`]:
                FieldValue.increment(1),

              updatedAt:
                now,
            }
          );
        } else {
          transaction.set(
            weeklyMetricRef,
            createInitialWeeklyMetric({
              placeId:
                placeRef.id,

              weekId,
              weekStartId,
              weekEndId,

              dayId,
              now,
            })
          );
        }

        /*
         * 4. Actualizar el estado de interacción
         * de este usuario con este lugar.
         */
        transaction.set(
          interactionStateRef,
          {
            uid,
            placeId:
              placeRef.id,

            hasReview:
              true,

            reviewId:
              reviewRef.id,

            lastReviewAt:
              now,

            lastReviewRating:
              reviewData.rating,

            lastReviewRecommended:
              reviewData.recommended,

            lastReviewHasDetails:
              reviewData.hasDetails,

            lastInteractionAt:
              now,

            createdAt:
              interactionStateDoc.exists
                ? interactionStateDoc
                    .data()
                    ?.createdAt ?? now
                : now,

            updatedAt:
              now,
          },
          {
            merge: true,
          }
        );

        /*
         * 5. Crear evento para actividad reciente.
         */
        transaction.set(
          eventRef,
          {
            eventId:
              eventRef.id,

            placeId:
              placeRef.id,

            type:
              PLACE_EVENT_TYPES
                .REVIEW_CREATED,

            actor: {
              type:
                "user",

              uid,
            },

            source: {
              app:
                "mobile",

              screen:
                "CommentScreen",
            },

            metadata: {
              reviewId:
                reviewRef.id,

              rating:
                reviewData.rating,

              recommended:
                reviewData.recommended,

              hasDetails:
                reviewData.hasDetails,

              hasComment:
                Boolean(
                  reviewData.commentText
                ),
            },

            period: {
              weekId,
              dayId,
            },

            createdAt:
              now,
          }
        );

        return {
          reviewId:
            reviewRef.id,

          placeId:
            placeRef.id,

          rating:
            reviewData.rating,

          recommended:
            reviewData.recommended,

          hasDetails:
            reviewData.hasDetails,

          metrics: {
            averageRating:
              nextAverageRating,

            ratingsCount:
              nextRatingsCount,

            commentsCount:
              nextCommentsCount,

            recommendationRate:
              nextRecommendationRate,
          },

          weeklyMetric: {
            weekId,
            dayId,

            reviewsCreatedIncremented:
              true,
          },

          interactionState: {
            hasReview:
              true,

            reviewId:
              reviewRef.id,
          },

          event: {
            eventId:
              eventRef.id,

            type:
              PLACE_EVENT_TYPES
                .REVIEW_CREATED,
          },
        };
      }
    );

  return result;
}