import registerPlaceFromCandidateService from "../../services/places/create/registerPlaceFromCandidate.service.js";

export default async function registerPlaceFromCandidateController(req, res) {
  try {
    const result = await registerPlaceFromCandidateService({
      body: req.body,
      adminUser: req.user || null,
    });

    return res.status(201).json({
      ok: true,
      message: "Lugar registrado correctamente desde candidato.",
      data: result,
    });
  } catch (error) {
    console.error("Error en registerPlaceFromCandidateController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudo registrar el lugar.",
    });
  }
}