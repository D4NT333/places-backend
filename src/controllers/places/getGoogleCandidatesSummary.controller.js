import getGoogleCandidatesSummaryService from "../../services/places/read/getGoogleCandidatesSummary.service.js";

export default async function getGoogleCandidatesSummaryController(req, res) {
  try {
    const result = await getGoogleCandidatesSummaryService();

    return res.status(200).json({
      ok: true,
      message: "Resumen de candidatos cargado correctamente",
      data: result,
    });
  } catch (error) {
    console.error("getGoogleCandidatesSummaryController error:", error);

    return res.status(500).json({
      ok: false,
      message: error.message || "Error al cargar resumen de candidatos",
    });
  }
}