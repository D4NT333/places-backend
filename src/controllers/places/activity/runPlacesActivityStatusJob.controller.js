import updatePlacesActivityStatusService from "../../../services/places/activity/updatePlacesActivityStatus.service.js";

function getBearerToken(req) {
  const authorization =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization.trim()
      : "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization
    .slice("Bearer ".length)
    .trim();
}

export default async function runPlacesActivityStatusJobController(
  req,
  res,
  next,
) {
  try {
    const expectedSecret =
      process.env.INTERNAL_JOBS_SECRET?.trim();

    const receivedSecret =
      getBearerToken(req);

    if (!expectedSecret) {
      const error = new Error(
        "El secreto de trabajos internos no está configurado.",
      );

      error.statusCode = 500;

      throw error;
    }

    if (
      !receivedSecret ||
      receivedSecret !== expectedSecret
    ) {
      return res.status(401).json({
        success: false,
        message:
          "No autorizado para ejecutar este trabajo interno.",
      });
    }

    const result =
      await updatePlacesActivityStatusService();

    return res.status(200).json({
      success: true,

      message:
        "Estados de actividad actualizados correctamente.",

      result,
    });
  } catch (error) {
    next(error);
  }
}