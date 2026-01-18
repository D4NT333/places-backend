import { searchNearbyService } from "../services/places.services.js";

export async function searchNearby(req, res) {
  try {
    const lat = Number(req.query.lat ?? 20.6736);
    const lng = Number(req.query.lng ?? -103.344);
    const radius = Number(req.query.radius ?? 1000);

    if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
      return res.status(400).json({ error: "Invalid query params" });
    }

    const data = await searchNearbyService({ lat, lng, radius });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
