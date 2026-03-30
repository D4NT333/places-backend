import { composeNearbyFeedService } from "../../services/feed/principal/composeFeed.service.js";

export async function getNearbyFeedController(req, res) {
  try {
    console.log("BODY RECIBIDO:", req.body);

    const { latitude, longitude } = req.body;

    console.log("LAT:", latitude);
    console.log("LONG:", longitude);

    if (latitude == null || longitude == null) {
      return res.status(400).json({
        ok: false,
        message: "latitude y longitude son requeridos",
      });
    }

    const result = await composeNearbyFeedService({ latitude, longitude });

    return res.status(200).json({
      ok: true,
      message: "Feed generado correctamente",
      data: result,
    });
  } catch (error) {
    console.error("Error en getNearbyFeedController:", error);

    return res.status(500).json({
      ok: false,
      message: "Error interno del servidor",
    });
  }
}