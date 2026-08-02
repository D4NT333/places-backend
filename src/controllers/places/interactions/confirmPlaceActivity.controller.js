import confirmPlaceActivityService
  from "../../../services/places/create/interactions/confirmPlaceActivity.service.js";

export default async function confirmPlaceActivityController(
  req,
  res,
  next,
) {
  try {
    const placeId =
      req.params.placeId;

    const uid =
      req.user?.uid;

    const result =
      await confirmPlaceActivityService({
        placeId,
        uid,
      });

    let message =
      "Gracias por confirmar que este lugar sigue activo.";

    if (
      result.alreadyConfirmed
    ) {
      message =
        "Ya habías confirmado que este lugar sigue activo.";
    } else if (
      result.becameActive
    ) {
      message =
        "Gracias. Con tu confirmación reunimos suficiente evidencia para marcar el lugar como activo.";
    }

    return res
      .status(200)
      .json({
        message,

        placeId,

        activityConfirmation: {
          alreadyConfirmed:
            result.alreadyConfirmed,

          confirmationsCount:
            result.confirmationsCount,

          requiredConfirmations:
            result.requiredConfirmations,

          canConfirm:
            result.canConfirm,
        },

        activityStatus:
          result.activityStatus,

        becameActive:
          result.becameActive,
      });
  } catch (error) {
    return next(error);
  }
}