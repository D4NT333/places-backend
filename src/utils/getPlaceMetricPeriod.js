const METRICS_TIME_ZONE = "America/Mexico_City";

function getCalendarParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  return parts.reduce((result, part) => {
    if (part.type !== "literal") {
      result[part.type] = Number(part.value);
    }

    return result;
  }, {});
}

function formatCalendarDate(date) {
  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function getPlaceMetricPeriod(
  date = new Date(),
) {
  const {
    year,
    month,
    day,
  } = getCalendarParts(
    date,
    METRICS_TIME_ZONE,
  );

  /*
   * Esta fecha UTC representa únicamente una fecha de calendario.
   * No representa la hora real del usuario.
   *
   * La utilizamos para movernos entre lunes y domingo sin que
   * la zona horaria cambie accidentalmente el día.
   */
  const calendarDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );

  const dayOfWeek = calendarDate.getUTCDay();

  /*
   * Domingo = 0
   * Lunes = 1
   * Martes = 2
   * ...
   */
  const daysSinceMonday =
    dayOfWeek === 0
      ? 6
      : dayOfWeek - 1;

  const weekStartDate = new Date(calendarDate);

  weekStartDate.setUTCDate(
    calendarDate.getUTCDate() - daysSinceMonday,
  );

  const weekEndDate = new Date(weekStartDate);

  weekEndDate.setUTCDate(
    weekStartDate.getUTCDate() + 6,
  );

  return {
    dayId: formatCalendarDate(calendarDate),

    /*
     * El ID del documento semanal siempre será el lunes.
     */
    weekId: formatCalendarDate(weekStartDate),

    weekStartId: formatCalendarDate(weekStartDate),
    weekEndId: formatCalendarDate(weekEndDate),
  };
}