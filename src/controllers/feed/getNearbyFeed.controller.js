import { composeNearbyFeedService } from "../../services/feed/principal/composeFeed.service.js";

export async function getNearbyFeedController(req, res) {
  console.log("ENTRÓ A /api/feed/location");
  console.log("BODY RECIBIDO:", req.body);

  try {
    const { latitude, longitude } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        ok: false,
        message: "latitude y longitude deben ser números válidos",
      });
    }

    const result = await composeNearbyFeedService({
      latitude: lat,
      longitude: lng,
    });

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