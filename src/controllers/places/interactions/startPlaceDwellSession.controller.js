import startPlaceDwellSessionService from "../../../services/places/create/interactions/startPlaceDwellSession.service.js";

export default async function startPlaceDwellSessionController(
  req,
  res,
) {
  try {
    const { placeId } = req.params;

    const uid =
      req.user?.uid ??
      req.firebaseUser?.uid;

    const result =
      await startPlaceDwellSessionService({
        placeId,
        uid,
      });

    console.info(
      result.reused
        ? "[PLACE_DWELL_SESSION_REUSED]"
        : "[PLACE_DWELL_SESSION_STARTED]",
      {
        placeId,
        uid,
        sessionId: result.sessionId,
      },
    );

    return res.status(200).json({
      ok: true,

      session: {
        sessionId: result.sessionId,
        reused: result.reused,
      },
    });
  } catch (error) {
    console.error(
      "[START_PLACE_DWELL_SESSION_ERROR]",
      {
        placeId: req.params?.placeId,

        uid:
          req.user?.uid ??
          req.firebaseUser?.uid ??
          null,

        message: error.message,
        stack: error.stack,
      },
    );

    return res
      .status(error.statusCode || 500)
      .json({
        ok: false,

        message:
          error.statusCode
            ? error.message
            : "No se pudo iniciar la sesión de permanencia.",
      });
  }
}