import rejectGooglePlaceCandidateService
  from "../../../services/places/update/rejectGooglePlaceCandidate.service.js";

export default async function rejectGooglePlaceCandidateController(
  req,
  res,
) {
  try {
    const {
      candidateId,
    } = req.params;

    const reason =
      typeof req.body?.reason ===
      "string"
        ? req.body.reason.trim()
        : "";

    const result =
      await rejectGooglePlaceCandidateService({
        candidateId,

        adminUser:
          req.user ||
          null,

        reason,
      });

    return res.status(200).json({
      ok: true,

      message:
        "Candidato rechazado correctamente.",

      data:
        result,
    });
  } catch (error) {
    console.error(
      "Error en rejectGooglePlaceCandidateController:",
      error,
    );

    return res
      .status(
        error.statusCode ||
        500,
      )
      .json({
        ok: false,

        message:
          error.message ||
          "No se pudo rechazar el candidato.",
      });
  }
}