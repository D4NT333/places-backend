import getPlaceDetailService from "../../services/places/read/getPlaceDetail.service.js";

function getBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || req.protocol || "http";

  return `${protocol}://${req.get("host")}`;
}

export default async function getPlaceDetailController(req, res, next) {
  try {
    const { placeId } = req.params;

    const result = await getPlaceDetailService({
      placeId,
      baseUrl: getBaseUrl(req),
      uid: req.user?.uid,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error en getPlaceDetailController:", error);
    return next(error);
  }
}