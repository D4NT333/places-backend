import { discoverPlacesByH3Service } from "../../services/places/read/discoverPlacesByH3.service.js";

export async function discoverPlacesByH3Controller(req, res) {
  try {
    const { hexId } = req.body;

    const result = await discoverPlacesByH3Service(hexId);

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("discoverPlacesByH3Controller error:", error);

    return res.status(400).json({
      ok: false,
      message: error.message,
    });
  }
}