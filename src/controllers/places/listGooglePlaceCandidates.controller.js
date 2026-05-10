import listGooglePlaceCandidatesService from "../../services/places/read/listGooglePlaceCandidates.service.js";

export default async function listGooglePlaceCandidatesController(req, res) {
  try {
    const { status, limit, cursor } = req.query;

    const result = await listGooglePlaceCandidatesService({
      status,
      limit,
      cursor,
    });

    return res.status(200).json({
      ok: true,
      message: "Candidatos de Google cargados correctamente",
      data: result,
    });
  } catch (error) {
    console.error("listGooglePlaceCandidatesController error:", error);

    return res.status(500).json({
      ok: false,
      message: error.message || "Error al cargar candidatos de Google",
    });
  }
}