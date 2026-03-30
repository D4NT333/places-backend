import { discoverPlacesByH3Service } from "../../services/places/read/discoverPlacesByH3.service.js";

export async function discoverPlacesByH3Controller(req, res) {
  try {
    const { hexId } = req.body;

    if (!hexId) {
      return res.status(400).json({
        ok: false,
        message: "hexId es requerido",
      });
    }

    const result = await discoverPlacesByH3Service(hexId);

    return res.status(200).json({
      ok: true,
      message: "Hex recibido correctamente",
      data: result,
    });
  } catch (error) {
    console.error("Error en discoverPlacesByH3Controller:", error);

    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
}