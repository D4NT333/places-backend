import registerPlaceViewService from "../../../services/places/create/interactions/registerPlaceView.service.js";

export default async function registerPlaceViewController(
  req,
  res,
) {
  try {
    const { placeId } = req.params;
    const uid =
      req.user?.uid ??
      req.firebaseUser?.uid;

    const result =
      await registerPlaceViewService({
        placeId,
        uid,
      });

    if (result.counted) {
      console.info(
        "[PLACE_VIEW_COUNTED]",
        {
          placeId,
          uid,

          viewsCount: result.viewsCount,

          weekId: result.weekId,
          dayId: result.dayId,
        },
      );
    } else {
      console.info(
        "[PLACE_VIEW_IGNORED]",
        {
          placeId,
          uid,

          reason: result.internalReason,

          retryAfterSeconds:
            result.retryAfterSeconds,
        },
      );
    }

    return res.status(200).json({
      ok: true,

      view: {
        counted: result.counted,
        viewsCount: result.viewsCount,
      },
    });
  } catch (error) {
    console.error(
      "[REGISTER_PLACE_VIEW_ERROR]",
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
            : "No se pudo registrar la visualización.",
      });
  }
}