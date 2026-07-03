import { db } from "../../../config/firebase.js";
import getPlaceRouteService from "../../../services/routes/read/getPlaceRoute.service.js";

export default async function getPlaceRouteController(req, res) {
  try {
    const { placeId } = req.params;

    // POST usa req.body, no req.query
    const { originLat, originLng, travelMode } = req.body;

    console.log("ROUTE PARAMS:", req.params);
    console.log("ROUTE BODY:", req.body);

    if (!placeId) {
      return res.status(400).json({
        ok: false,
        message: "Falta el placeId.",
      });
    }

    if (
      !Number.isFinite(Number(originLat)) ||
      !Number.isFinite(Number(originLng))
    ) {
      return res.status(400).json({
        ok: false,
        message: "Falta la ubicación actual del usuario.",
        debug: {
          originLat,
          originLng,
          body: req.body,
        },
      });
    }

    const placeSnap = await db.collection("places").doc(placeId).get();

    if (!placeSnap.exists) {
      return res.status(404).json({
        ok: false,
        message: "Lugar no encontrado.",
      });
    }

    const place = {
      placeId: placeSnap.id,
      ...placeSnap.data(),
    };

    if (place.deletedAt) {
      return res.status(404).json({
        ok: false,
        message: "Lugar no disponible.",
      });
    }

    if (place.status !== "published") {
      return res.status(404).json({
        ok: false,
        message: "Lugar no publicado.",
      });
    }

    const route = await getPlaceRouteService({
      originLat,
      originLng,
      travelMode,
      place,
    });

    return res.status(200).json({
      ok: true,
      route,
    });
  } catch (error) {
    console.error("getPlaceRouteController error:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error al calcular la ruta.",
      details: error.details || null,
    });
  }
}