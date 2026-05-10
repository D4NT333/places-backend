import getGooglePlaceCandidateDetailsService from "../../services/places/read/getGooglePlaceCandidateDetails.service.js";

export default async function getGooglePlaceCandidateDetailsController(req, res) {
  try {
    const { googlePlaceId } = req.params;

    const result = await getGooglePlaceCandidateDetailsService(googlePlaceId);

    return res.status(200).json({
      ok: true,
      message: "Detalle de candidato cargado correctamente",
      data: result,
    });
  } catch (error) {
    console.error("getGooglePlaceCandidateDetailsController error:", error);

    return res.status(500).json({
      ok: false,
      message: error.message || "Error al cargar detalle del candidato",
    });
  }
}