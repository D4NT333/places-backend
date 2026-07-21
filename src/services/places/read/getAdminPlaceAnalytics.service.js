import {
  Timestamp,
} from "firebase-admin/firestore";

import {
  db,
} from "../../../config/firebase.js";

const RECENT_EVENTS_LIMIT = 12;

const WEEK_DAY_LABELS = [
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
  "Dom",
];

/*
 * Zona utilizada actualmente por Lsearch.
 *
 * La fecha se interpreta tomando como referencia
 * Guadalajara, UTC-6.
 */
const METRICS_TIME_ZONE_OFFSET = "-06:00";
const METRICS_TIME_ZONE_HOURS = 6;

function createHttpError(
  message,
  statusCode = 400,
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(
    Math.trunc(parsed),
    0,
  );
}

function normalizeNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function serializeDate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate === "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  return null;
}

function isValidDateId(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

function parseDateId(dateId) {
  if (!isValidDateId(dateId)) {
    return null;
  }

  const [
    year,
    month,
    day,
  ] = dateId
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateId(date) {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      date.getUTCDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDateId(
  dateId,
  daysToAdd,
) {
  const date =
    parseDateId(dateId);

  if (!date) {
    return null;
  }

  date.setUTCDate(
    date.getUTCDate() +
    daysToAdd,
  );

  return formatDateId(date);
}

function getCurrentLocalDateId() {
  /*
   * Transformamos el instante actual
   * a la fecha local UTC-6.
   */
  const localDate = new Date(
    Date.now() -
    METRICS_TIME_ZONE_HOURS *
      60 *
      60 *
      1000,
  );

  return formatDateId(localDate);
}

function getLocalDateIdFromValue(value) {
  if (!value) {
    return null;
  }

  let date = null;

  if (
    typeof value.toDate === "function"
  ) {
    date = value.toDate();
  } else if (
    value instanceof Date
  ) {
    date = value;
  } else if (
    typeof value === "string"
  ) {
    date = new Date(value);
  }

  if (
    !date ||
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  const localDate = new Date(
    date.getTime() -
    METRICS_TIME_ZONE_HOURS *
      60 *
      60 *
      1000,
  );

  return formatDateId(localDate);
}

function getWeekStartId(dateId) {
  const date =
    parseDateId(dateId);

  if (!date) {
    return null;
  }

  /*
   * JavaScript:
   *
   * 0 = domingo
   * 1 = lunes
   * ...
   * 6 = sábado
   *
   * Convertimos cualquier fecha al lunes
   * de su misma semana.
   */
  const dayOfWeek =
    date.getUTCDay();

  const daysSinceMonday =
    (dayOfWeek + 6) % 7;

  date.setUTCDate(
    date.getUTCDate() -
    daysSinceMonday,
  );

  return formatDateId(date);
}

function createLocalDayTimestamp(
  dateId,
) {
  if (!isValidDateId(dateId)) {
    throw createHttpError(
      "La fecha solicitada no es válida.",
      400,
    );
  }

  const date = new Date(
    `${dateId}T00:00:00${METRICS_TIME_ZONE_OFFSET}`,
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    throw createHttpError(
      "No se pudo interpretar la fecha solicitada.",
      400,
    );
  }

  return Timestamp.fromDate(date);
}

function buildWeekRange(
  weekStartId,
) {
  const weekEndId =
    addDaysToDateId(
      weekStartId,
      6,
    );

  const nextWeekStartId =
    addDaysToDateId(
      weekStartId,
      7,
    );

  if (
    !weekEndId ||
    !nextWeekStartId
  ) {
    throw createHttpError(
      "La semana solicitada no es válida.",
      400,
    );
  }

  return {
    weekStartId,
    weekEndId,
    nextWeekStartId,

    startTimestamp:
      createLocalDayTimestamp(
        weekStartId,
      ),

    nextWeekStartTimestamp:
      createLocalDayTimestamp(
        nextWeekStartId,
      ),
  };
}

/*
 * Genera las opciones del selector.
 *
 * Empieza en la semana actual y retrocede
 * hasta la semana en que nació el lugar.
 *
 * Estas semanas no tienen que existir
 * físicamente en weeklyMetrics.
 */
function buildAvailableWeeks(
  placeCreatedAt,
) {
  const currentDateId =
    getCurrentLocalDateId();

  const currentWeekStartId =
    getWeekStartId(
      currentDateId,
    );

  const placeCreationDateId =
    getLocalDateIdFromValue(
      placeCreatedAt,
    ) || currentDateId;

  const placeCreationWeekStartId =
    getWeekStartId(
      placeCreationDateId,
    );

  if (
    !currentWeekStartId ||
    !placeCreationWeekStartId
  ) {
    return [];
  }

  const availableWeeks = [];

  let currentCursor =
    currentWeekStartId;

  while (
    currentCursor >=
    placeCreationWeekStartId
  ) {
    availableWeeks.push({
      weekId:
        currentCursor,

      weekStartId:
        currentCursor,

      weekEndId:
        addDaysToDateId(
          currentCursor,
          6,
        ),
    });

    currentCursor =
      addDaysToDateId(
        currentCursor,
        -7,
      );
  }

  return availableWeeks;
}

function buildWeeklyDays({
  weekStartId,
  days,
}) {
  return WEEK_DAY_LABELS.map(
    (label, index) => {
      const dayId =
        addDaysToDateId(
          weekStartId,
          index,
        );

      const day =
        days?.[dayId] || {};

      const likesAdded =
        normalizeCount(
          day.likesAdded,
        );

      const likesRemoved =
        normalizeCount(
          day.likesRemoved,
        );

      const reviewsCreated =
        normalizeCount(
          day.reviewsCreated,
        );

      const reviewsDeleted =
        normalizeCount(
          day.reviewsDeleted,
        );

      return {
        dayId,
        label,

        views:
          normalizeCount(
            day.views,
          ),

        likesAdded,
        likesRemoved,

        netLikes:
          likesAdded -
          likesRemoved,

        reviewsCreated,
        reviewsDeleted,

        netReviews:
          reviewsCreated -
          reviewsDeleted,

        dwellTimeSeconds:
          normalizeCount(
            day.dwellTimeSeconds,
          ),

        validSessions:
          normalizeCount(
            day.validSessions,
          ),

        averageDwellTimeSeconds:
          normalizeNumber(
            day.averageDwellTimeSeconds,
          ),
      };
    },
  );
}

function getEventLabel(type) {
  const labels = {
    place_view:
      "Se registró una visualización.",

    place_like_added:
      "Un usuario marcó el lugar como favorito.",

    place_like_removed:
      "Un usuario quitó el lugar de favoritos.",

    place_dwell_time_recorded:
      "Se registró tiempo de permanencia.",

    place_review_created:
      "Un usuario publicó una reseña.",

    place_review_deleted:
      "Se eliminó una reseña.",

    place_description_submission_created:
      "Se creó una propuesta de descripción.",

    place_photo_submission_created:
      "Se creó una propuesta de fotografías.",

    place_report_created:
      "Se creó un reporte relacionado con el lugar.",
  };

  return (
    labels[type] ||
    "Se registró una actividad en el lugar."
  );
}

function normalizeEvent(document) {
  const event =
    document.data();

  return {
    id:
      document.id,

    eventId:
      event.eventId ||
      document.id,

    type:
      event.type ||
      "unknown",

    label:
      getEventLabel(
        event.type,
      ),

    actor: {
      type:
        event.actor?.type ||
        null,

      uid:
        event.actor?.uid ||
        null,
    },

    source: {
      app:
        event.source?.app ||
        null,

      screen:
        event.source?.screen ||
        null,
    },

    metadata:
      event.metadata ||
      {},

    period: {
      weekId:
        event.period?.weekId ||
        null,

      dayId:
        event.period?.dayId ||
        null,
    },

    createdAt:
      serializeDate(
        event.createdAt,
      ),
  };
}

async function getWeeklyMetricSnapshot({
  placeRef,
  weekId,
}) {
  return placeRef
    .collection("weeklyMetrics")
    .doc(weekId)
    .get();
}

export default async function getAdminPlaceAnalyticsService({
  placeId,
  weekId = null,
}) {
  if (
    typeof placeId !== "string" ||
    !placeId.trim()
  ) {
    throw createHttpError(
      "El identificador del lugar es obligatorio.",
      400,
    );
  }

  const normalizedPlaceId =
    placeId.trim();

  const normalizedWeekId =
    typeof weekId === "string" &&
    weekId.trim()
      ? weekId.trim()
      : null;

  if (
    normalizedWeekId &&
    !isValidDateId(
      normalizedWeekId,
    )
  ) {
    throw createHttpError(
      "El identificador de la semana no es válido.",
      400,
    );
  }

  const placeRef =
    db
      .collection("places")
      .doc(normalizedPlaceId);

  const placeSnapshot =
    await placeRef.get();

  if (!placeSnapshot.exists) {
    throw createHttpError(
      "No se encontró el lugar solicitado.",
      404,
    );
  }

  const placeData =
    placeSnapshot.data();

  /*
   * Selector desde la semana actual
   * hasta la semana en que nació el lugar.
   */
  const availableWeeks =
    buildAvailableWeeks(
      placeData.createdAt,
    );

  /*
   * Sin parámetro:
   * elegimos la semana actual.
   *
   * Con parámetro:
   * usamos la semana enviada por el frontend.
   */
  const selectedWeekId =
    normalizedWeekId ||
    availableWeeks[0]?.weekId;

  if (!selectedWeekId) {
    throw createHttpError(
      "No se pudo determinar la semana seleccionada.",
      500,
    );
  }

  const selectedWeekExists =
    availableWeeks.some(
      (availableWeek) =>
        availableWeek.weekId ===
        selectedWeekId,
    );

  if (!selectedWeekExists) {
    throw createHttpError(
      "La semana solicitada está fuera del periodo de existencia del lugar.",
      400,
    );
  }

  const selectedWeekSnapshot =
    await getWeeklyMetricSnapshot({
      placeRef,
      weekId:
        selectedWeekId,
    });

  /*
   * Si no existe weeklyMetrics/{weekId},
   * usamos un objeto vacío.
   *
   * Así las interacciones y las vistas
   * aparecen en cero, pero la semana
   * sigue existiendo en el selector.
   */
  const selectedWeekData =
    selectedWeekSnapshot.exists
      ? selectedWeekSnapshot.data()
      : null;

  const selectedWeekStartId =
    selectedWeekId;

  const {
    weekEndId,
    startTimestamp,
    nextWeekStartTimestamp,
  } = buildWeekRange(
    selectedWeekStartId,
  );

  /*
   * Actividad diaria:
   * actualmente solo trae eventos de hoy.
   *
   * Esto es independiente de la semana
   * seleccionada en las gráficas.
   */
  const todayId =
    getCurrentLocalDateId();

  const tomorrowId =
    addDaysToDateId(
      todayId,
      1,
    );

  const todayStartTimestamp =
    createLocalDayTimestamp(
      todayId,
    );

  const tomorrowStartTimestamp =
    createLocalDayTimestamp(
      tomorrowId,
    );

  const [
    recentEventsSnapshot,
    descriptionSubmissionsSnapshot,
    photoSubmissionsSnapshot,
    reportsSnapshot,
  ] = await Promise.all([
    placeRef
      .collection("events")
      .where(
        "createdAt",
        ">=",
        todayStartTimestamp,
      )
      .where(
        "createdAt",
        "<",
        tomorrowStartTimestamp,
      )
      .orderBy(
        "createdAt",
        "desc",
      )
      .limit(
        RECENT_EVENTS_LIMIT,
      )
      .get(),

    db
      .collection(
        "descriptionSubmissions",
      )
      .where(
        "placeId",
        "==",
        normalizedPlaceId,
      )
      .where(
        "createdAt",
        ">=",
        startTimestamp,
      )
      .where(
        "createdAt",
        "<",
        nextWeekStartTimestamp,
      )
      .get(),

    db
      .collection(
        "photoSubmissions",
      )
      .where(
        "placeId",
        "==",
        normalizedPlaceId,
      )
      .where(
        "createdAt",
        ">=",
        startTimestamp,
      )
      .where(
        "createdAt",
        "<",
        nextWeekStartTimestamp,
      )
      .get(),

    db
      .collection(
        "reports",
      )
      .where(
        "place.placeId",
        "==",
        normalizedPlaceId,
      )
      .where(
        "createdAt",
        ">=",
        startTimestamp,
      )
      .where(
        "createdAt",
        "<",
        nextWeekStartTimestamp,
      )
      .get(),
  ]);

  const totals =
    selectedWeekData?.totals ||
    {};

  const days =
    selectedWeekData?.days ||
    {};

  const likesAdded =
    normalizeCount(
      totals.likesAdded,
    );

  const likesRemoved =
    normalizeCount(
      totals.likesRemoved,
    );

  const reviewsCreated =
    normalizeCount(
      totals.reviewsCreated,
    );

  const reviewsDeleted =
    normalizeCount(
      totals.reviewsDeleted,
    );

  const photosSubmitted =
    photoSubmissionsSnapshot
      .docs
      .reduce(
        (
          currentTotal,
          document,
        ) => {
          const submission =
            document.data();

          return (
            currentTotal +
            normalizeCount(
              submission.photoCount,
            )
          );
        },
        0,
      );

  return {
    place: {
      placeId:
        normalizedPlaceId,

      name:
        placeData.name ||
        "Lugar sin nombre",

      createdAt:
        serializeDate(
          placeData.createdAt,
        ),
    },

    week: {
      weekId:
        selectedWeekId,

      weekStartId:
        selectedWeekStartId,

      weekEndId,

      /*
       * Permite saber si esa semana
       * tiene métricas acumuladas reales.
       */
      hasWeeklyMetric:
        selectedWeekSnapshot.exists,

      createdAt:
        serializeDate(
          selectedWeekData?.createdAt,
        ),

      updatedAt:
        serializeDate(
          selectedWeekData?.updatedAt,
        ),
    },

    interactions: {
      likesAdded,
      likesRemoved,

      netLikes:
        likesAdded -
        likesRemoved,

      reviewsCreated,
      reviewsDeleted,

      netReviews:
        reviewsCreated -
        reviewsDeleted,

      dwellTimeSeconds:
        normalizeCount(
          totals.dwellTimeSeconds,
        ),

      validSessions:
        normalizeCount(
          totals.validSessions,
        ),

      averageDwellTimeSeconds:
        normalizeNumber(
          totals.averageDwellTimeSeconds,
        ),
    },

    views: {
      total:
        normalizeCount(
          totals.views,
        ),

      days:
        buildWeeklyDays({
          weekStartId:
            selectedWeekStartId,

          days,
        }),
    },

    contributions: {
      descriptions:
        descriptionSubmissionsSnapshot
          .size,

      photoSubmissions:
        photoSubmissionsSnapshot
          .size,

      photos:
        photosSubmitted,

      reports:
        reportsSnapshot.size,
    },

    /*
     * Solo eventos del día actual.
     * No cambia cuando eliges otra semana.
     */
    activity: {
      dayId:
        todayId,

      events:
        recentEventsSnapshot
          .docs
          .map(
            normalizeEvent,
          ),
    },

    /*
     * Lo conservamos también para no romper
     * tu frontend actual.
     */
    recentActivity:
      recentEventsSnapshot
        .docs
        .map(
          normalizeEvent,
        ),

    /*
     * Semana actual primero.
     * Después las anteriores hasta
     * la creación del lugar.
     */
    availableWeeks,
  };
}