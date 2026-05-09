import createPlaceCandidateService from "../../services/places/create/createPlaceCandidate.service.js";

export default async function discoverPlacesByH3Controller(req, res) {
  try {
    const { hexId } = req.body;

    const result = await createPlaceCandidateService(hexId);

    return res.status(200).json({
      ok: true,
      message: "Discovery completed successfully",
      data: result,
    });
  } catch (error) {
    console.error("discoverPlacesByH3Controller error:", error);

    return res.status(400).json({
      ok: false,
      message: error.message || "Error discovering places",
    });
  }
}