import { db } from "../../../../config/firebase.js";
import admin from "firebase-admin";

import {
  createUserNotificationService,
} from "../../../notifications/createUserNotification.service.js";

import {
  sendPushNotificationToUserService,
} from "../../../notifications/sendPushNotificationToUser.service.js";

const PLACE_SUBMISSIONS_COLLECTION =
  "placeSubmissions";

const PLACES_COLLECTION =
  "places";

const MIN_MAIN_PHOTO_WIDTH =
  1080;

const MIN_MAIN_PHOTO_HEIGHT =
  720;

function createServiceError(
  message,
  statusCode,
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
}

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeReferenceIds(
  values,
  prefix,
) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) => {
          if (
            typeof value ===
            "string"
          ) {
            return value.trim();
          }

          if (
            value &&
            typeof value ===
              "object"
          ) {
            return cleanString(
              value.id ||
                value.value ||
                value.subtagId ||
                value.approachId,
            );
          }

          return "";
        })
        .filter(Boolean)
        .filter((value) =>
          value.startsWith(prefix),
        ),
    ),
  ];
}

function normalizeLocation(
  location,
) {
  const lat =
    location?.lat ??
    location?.latitude;

  const lng =
    location?.lng ??
    location?.longitude;

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return {
    lat,
    lng,
  };
}

function normalizePhoto(
  photo,
  index,
  submissionId,
  uploadedBy,
) {
  const mediumUrl =
    cleanString(
      photo?.medium?.url ||
        photo?.mediumUrl,
    );

  const thumbnailUrl =
    cleanString(
      photo?.thumbnail?.url ||
        photo?.thumbnailUrl,
    );

  const originalUrl =
    cleanString(
      photo?.original?.url ||
        photo?.originalUrl,
    );

  return {
    ...photo,

    photoId:
      cleanString(
        photo?.photoId,
      ) ||
      `photo_${index + 1}`,

    order: index,

    source:
      "user",

    sourceSubmissionId:
      submissionId,

    uploadedBy,

    /*
     * URL principal de uso general.
     * Priorizamos medium para evitar cargar
     * la original en feed o tarjetas.
     */
    url:
      mediumUrl ||
      originalUrl ||
      thumbnailUrl,

    path:
      cleanString(
        photo?.medium?.path ||
          photo?.path,
      ),

    /*
     * Estas dimensiones representan
     * la variante medium usada como portada.
     */
    widthPx:
      photo?.medium?.width ??
      photo?.medium?.widthPx ??
      photo?.widthPx ??
      null,

    heightPx:
      photo?.medium?.height ??
      photo?.medium?.heightPx ??
      photo?.heightPx ??
      null,
  };
}

function getPhotoOriginalWidth(
  photo,
) {
  const width =
    Number(
      photo?.original?.width ??
        photo?.original
          ?.widthPx ??
        photo?.originalWidth ??
        photo?.originalWidthPx ??
        photo?.widthPx ??
        photo?.medium?.width ??
        photo?.medium?.widthPx ??
        0,
    );

  return Number.isFinite(width)
    ? width
    : 0;
}

function getPhotoOriginalHeight(
  photo,
) {
  const height =
    Number(
      photo?.original?.height ??
        photo?.original
          ?.heightPx ??
        photo?.originalHeight ??
        photo?.originalHeightPx ??
        photo?.heightPx ??
        photo?.medium?.height ??
        photo?.medium?.heightPx ??
        0,
    );

  return Number.isFinite(height)
    ? height
    : 0;
}

function getPhotoResolution(
  photo,
) {
  return (
    getPhotoOriginalWidth(
      photo,
    ) *
    getPhotoOriginalHeight(
      photo,
    )
  );
}

function meetsMainPhotoResolution(
  photo,
) {
  const width =
    getPhotoOriginalWidth(
      photo,
    );

  const height =
    getPhotoOriginalHeight(
      photo,
    );

  return (
    width >=
      MIN_MAIN_PHOTO_WIDTH &&
    height >=
      MIN_MAIN_PHOTO_HEIGHT
  );
}

function selectMainPhotoSource(
  photos = [],
) {
  if (
    !Array.isArray(photos) ||
    photos.length === 0
  ) {
    return null;
  }

  /*
   * Primero intentamos elegir únicamente
   * entre fotos que cumplen 1080x720.
   */
  const eligiblePhotos =
    photos.filter(
      meetsMainPhotoResolution,
    );

  /*
   * Para no romper propuestas antiguas:
   * si ninguna cumple, seleccionamos entre
   * todas las fotos disponibles.
   */
  const candidates =
    eligiblePhotos.length > 0
      ? eligiblePhotos
      : photos;

  let selectedPhoto =
    candidates[0];

  let selectedResolution =
    getPhotoResolution(
      selectedPhoto,
    );

  for (
    let index = 1;
    index <
    candidates.length;
    index += 1
  ) {
    const currentPhoto =
      candidates[index];

    const currentResolution =
      getPhotoResolution(
        currentPhoto,
      );

    /*
     * Solo reemplazamos cuando la resolución
     * es estrictamente mayor.
     *
     * En empate se conserva la primera foto
     * según el orden original.
     */
    if (
      currentResolution >
      selectedResolution
    ) {
      selectedPhoto =
        currentPhoto;

      selectedResolution =
        currentResolution;
    }
  }

  return selectedPhoto;
}

function buildMainPhoto(
  selectedPhoto,
  approvedAtIso,
) {
  if (!selectedPhoto) {
    return null;
  }

  const medium =
    selectedPhoto.medium ||
    null;

  const thumbnail =
    selectedPhoto.thumbnail ||
    null;

  const mediumUrl =
    cleanString(
      medium?.url ||
        selectedPhoto.mediumUrl ||
        selectedPhoto.url,
    );

  const thumbnailUrl =
    cleanString(
      thumbnail?.url ||
        selectedPhoto
          .thumbnailUrl,
    );

  return {
    photoId:
      selectedPhoto.photoId,

    source:
      selectedPhoto.source,

    sourceSubmissionId:
      selectedPhoto
        .sourceSubmissionId,

    uploadedBy:
      selectedPhoto.uploadedBy,

    order:
      selectedPhoto.order,

    /*
     * mainPhoto usa medium como portada.
     * Nunca priorizamos original aquí.
     */
    url:
      mediumUrl ||
      thumbnailUrl ||
      null,

    path:
      cleanString(
        medium?.path ||
          selectedPhoto.path,
      ),

    widthPx:
      medium?.width ??
      medium?.widthPx ??
      selectedPhoto.widthPx ??
      null,

    heightPx:
      medium?.height ??
      medium?.heightPx ??
      selectedPhoto.heightPx ??
      null,

    medium,

    thumbnail,

    approvedAt:
      approvedAtIso,
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

function getCurrentWeekId(
  date = new Date(),
) {
  const currentDate =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );

  const currentDay =
    currentDate.getUTCDay();

  const daysSinceMonday =
    currentDay === 0
      ? 6
      : currentDay - 1;

  currentDate.setUTCDate(
    currentDate.getUTCDate() -
      daysSinceMonday,
  );

  return currentDate
    .toISOString()
    .slice(0, 10);
}

function buildActivityCheckpoint() {
  return {
    weekId:
      getCurrentWeekId(),

    views:
      0,

    likesAdded:
      0,

    reviewsCreated:
      0,

    validSessions:
      0,

    communityConfirmationUserIds:
      [],
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
    throw createServiceError(
      "Falta el id de la propuesta.",
      400,
    );
  }

  const submissionRef =
    db
      .collection(
        PLACE_SUBMISSIONS_COLLECTION,
      )
      .doc(submissionId);

  const approvalResult =
    await db.runTransaction(
      async (transaction) => {
        const submissionSnap =
          await transaction.get(
            submissionRef,
          );

        if (
          !submissionSnap.exists
        ) {
          throw createServiceError(
            "La propuesta no existe.",
            404,
          );
        }

        const submission =
          submissionSnap.data();

        if (
          ![
            "pending",
            "in_review",
            "resubmitted",
          ].includes(
            submission.status,
          )
        ) {
          throw createServiceError(
            "Esta propuesta ya fue procesada.",
            409,
          );
        }

        const location =
          normalizeLocation(
            submission.location,
          );

        if (!location) {
          throw createServiceError(
            "La ubicación de la propuesta no es válida.",
            400,
          );
        }

        const photos =
          Array.isArray(
            submission.photos,
          )
            ? submission.photos.map(
                (
                  photo,
                  index,
                ) =>
                  normalizePhoto(
                    photo,
                    index,
                    submission
                      .placeSubmissionId ||
                      submissionId,
                    submission.createdBy,
                  ),
              )
            : [];

        if (
          photos.length < 1
        ) {
          throw createServiceError(
            "La propuesta no tiene fotos válidas.",
            400,
          );
        }

        const normalizedSubtags =
          normalizeReferenceIds(
            submission.subtags,
            "subtag_",
          );

        const normalizedApproaches =
          normalizeReferenceIds(
            submission.approaches,
            "approach_",
          );

        if (
          normalizedSubtags.length ===
          0
        ) {
          throw createServiceError(
            "La propuesta no contiene IDs válidos de subetiquetas.",
            400,
          );
        }

        if (
          normalizedApproaches.length ===
          0
        ) {
          throw createServiceError(
            "La propuesta no contiene IDs válidos de enfoques.",
            400,
          );
        }

        const now =
          admin.firestore
            .FieldValue
            .serverTimestamp();

        const placeRef =
          db
            .collection(
              PLACES_COLLECTION,
            )
            .doc();

        const approvedAtIso =
          new Date().toISOString();

        /*
         * Elegimos la foto usando la calidad
         * de la original.
         */
        const selectedPhoto =
          selectMainPhotoSource(
            photos,
          );

        /*
         * Guardamos medium como mainPhoto
         * para feed y portada.
         */
        const mainPhoto =
          buildMainPhoto(
            selectedPhoto,
            approvedAtIso,
          );

        if (!mainPhoto) {
          throw createServiceError(
            "No fue posible seleccionar la foto principal.",
            400,
          );
        }

        const placeData = {
          placeId:
            placeRef.id,

          name:
            cleanString(
              submission.name,
            ),

          description:
            cleanString(
              submission.description,
            ),

          address:
            cleanString(
              submission.address,
            ),

          location,

          tagId:
            cleanString(
              submission.tagId,
            ),

          tagLabel:
            cleanString(
              submission.tagLabel,
            ),

          subtags:
            normalizedSubtags,

          approaches:
            normalizedApproaches,

          price:
            cleanString(
              submission.price,
            ),

          priceRangeId:
            cleanString(
              submission
                .priceRangeId,
            ),

          openingHours:
            submission.openingHours ||
            {
              type:
                "not_specified",

              label:
                "Horario no especificado",

              days: [],

              openTime: null,

              closeTime: null,

              isOpenNow: false,

              lastScheduleCheckAt:
                null,
            },

          /*
           * Conservamos todas las variantes
           * de cada foto para la galería.
           */
          photos:
            photos.map(
              (photo) => ({
                ...photo,

                approvedAt:
                  approvedAtIso,
              }),
            ),

          /*
           * La portada usa medium y conserva
           * thumbnail para listas pequeñas.
           */
          mainPhoto,

          photoCount:
            photos.length,

          metrics:
            buildMetrics(),

          trend:
            buildTrend(),

          status:
            "published",

          activityStatus:
            "active",

            activityCheckpoint:
            buildActivityCheckpoint(),

          source:
            "mobile",

          createdBy:
            submission.createdBy ||
            null,

          createdAt:
            now,

          updatedAt:
            now,

          deletedAt:
            null,

          lastInteractionAt:
            now,

          activityStatusUpdatedAt:
            now,

          confirmationStartedAt:
            null,

          origin: {
            type:
              "place_submission",

            submissionId,

            placeSubmissionId:
              submission
                .placeSubmissionId ||
              submissionId,

            submittedBy:
              submission.createdBy ||
              null,

            approvedBy:
              approvedBy ||
              "admin_panel",

            approvedAt:
              now,
          },
        };

        transaction.set(
          placeRef,
          placeData,
        );

        transaction.update(
          submissionRef,
          {
            status:
              "approved",

            approvedAt:
              now,

            approvedBy:
              approvedBy ||
              "admin_panel",

            createdPlaceId:
              placeRef.id,

            updatedAt:
              now,
          },
        );

        return {
          placeId:
            placeRef.id,

          submissionId,

          status:
            "approved",

          createdBy:
            submission.createdBy ||
            null,

          placeName:
            cleanString(
              submission.name,
            ),
        };
      },
    );

  const notificationData = {
    screen:
      "VisualizedAddedPlacesScreen",

    type:
      "place_submission_approved",

    submissionId:
      approvalResult.submissionId,

    placeId:
      approvalResult.placeId,
  };

  if (
    approvalResult.createdBy
  ) {
    const title =
      "Tu propuesta fue aprobada";

    const body =
      approvalResult.placeName
        ? `Tu propuesta de “${approvalResult.placeName}” fue aprobada y publicada.`
        : "Tu propuesta de lugar fue aprobada y publicada.";

    try {
      const notification =
        await createUserNotificationService(
          {
            uid:
              approvalResult
                .createdBy,

            type:
              "place_submission_approved",

            title,

            body,

            data:
              notificationData,
          },
        );

      const pushResult =
        await sendPushNotificationToUserService(
          {
            uid:
              approvalResult
                .createdBy,

            title,

            body,

            data: {
              ...notificationData,

              notificationId:
                notification.id,
            },
          },
        );

      console.log(
        "Notificación de aprobación enviada:",
        {
          submissionId,

          uid:
            approvalResult
              .createdBy,

          sent:
            pushResult.sent,
        },
      );
    } catch (
      notificationError
    ) {
      console.error(
        "La propuesta fue aprobada, pero falló la notificación:",
        notificationError,
      );
    }
  }

  return {
    placeId:
      approvalResult.placeId,

    submissionId:
      approvalResult
        .submissionId,

    status:
      approvalResult.status,
  };
}