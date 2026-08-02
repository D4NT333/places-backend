import resetPlacesActivityCheckpointsService
  from "../../../services/places/activity/resetPlacesActivityCheckpoints.service.js";

function getBearerToken(
  authorizationHeader
) {
  if (
    typeof authorizationHeader !==
    "string"
  ) {
    return "";
  }

  const [
    scheme,
    token,
  ] =
    authorizationHeader
      .trim()
      .split(/\s+/);

  if (
    scheme?.toLowerCase() !==
      "bearer" ||
    !token
  ) {
    return "";
  }

  return token.trim();
}

export default async function resetPlacesActivityCheckpointsController(
  req,
  res,
  next
) {
  try {
    const receivedSecret =
      getBearerToken(
        req.headers.authorization
      );

    const expectedSecret =
      process.env
        .INTERNAL_JOBS_SECRET
        ?.trim();

    if (!expectedSecret) {
      const error =
        new Error(
          "Falta configurar INTERNAL_JOBS_SECRET en el backend."
        );

      error.statusCode =
        500;

      throw error;
    }

    if (
      !receivedSecret ||
      receivedSecret !==
        expectedSecret
    ) {
      const error =
        new Error(
          "No tienes autorización para ejecutar este proceso."
        );

      error.statusCode =
        401;

      throw error;
    }

    const result =
      await resetPlacesActivityCheckpointsService();

    return res
      .status(200)
      .json({
        message:
          result.updatedCount > 0
            ? "Los checkpoints de actividad fueron actualizados."
            : "Ningún checkpoint necesitaba actualizarse.",

        result,
      });
  } catch (error) {
    return next(error);
  }
}