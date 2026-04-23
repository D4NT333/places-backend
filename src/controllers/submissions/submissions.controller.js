import createPlaceSubmissionService from "../../services/submissions/create/createPlaceSubmission.service.js";

export default async function createPlaceSubmissionController(req, res) {
  try {
    const result = await createPlaceSubmissionService(req.body);

    return res.status(201).json({
      ok: true,
      message: "Place submission recibida correctamente",
      data: result,
    });
  } catch (error) {
    console.error("Error en createPlaceSubmissionController:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al recibir place submission",
    });
  }
}