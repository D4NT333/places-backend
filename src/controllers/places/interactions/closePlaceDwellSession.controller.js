import closePlaceDwellSessionService from "../../../services/places/create/interactions/closePlaceDwellSession.service.js";

export default async function closePlaceDwellSessionController(
  req,
  res,
) {
  try {
    const {
      placeId,
      sessionId,
    } = req.params;

    const uid =
      req.user?.uid ??
      req.firebaseUser?.uid;

    const result =
      await closePlaceDwellSessionService({
        placeId,
        sessionId,
        uid,
      });

    console.info(
      result.counted
        ? "[PLACE_DWELL_TIME_RECORDED]"
        : "[PLACE_DWELL_TIME_IGNORED]",
      {
        placeId,
        uid,
        sessionId,

        durationSeconds:
          result.durationSeconds,

        countedDurationSeconds:
          result.countedDurationSeconds,

        capped:
          result.capped,

        alreadyClosed:
          result.alreadyClosed,
      },
    );

    return res.status(200).json({
      ok: true,

      session: {
        sessionId:
          result.sessionId,

        durationSeconds:
          result.durationSeconds,

        countedDurationSeconds:
          result.countedDurationSeconds,

        counted:
          result.counted,

        capped:
          result.capped,

        alreadyClosed:
          result.alreadyClosed,
      },
    });
  } catch (error) {
    console.error(
      "[CLOSE_PLACE_DWELL_SESSION_ERROR]",
      {
        placeId:
          req.params?.placeId,

        sessionId:
          req.params?.sessionId,

        uid:
          req.user?.uid ??
          req.firebaseUser?.uid ??
          null,

        message:
          error.message,

        stack:
          error.stack,
      },
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,

        message:
          error.statusCode
            ? error.message
            : "No se pudo cerrar la sesión de permanencia.",
      });
  }
}