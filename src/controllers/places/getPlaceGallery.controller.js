import getPlaceGalleryService
  from "../../services/places/read/getPlaceGallery.service.js";

export default async function getPlaceGalleryController(
  req,
  res,
  next,
) {
  try {
    const result =
      await getPlaceGalleryService({
        placeId:
          req.params.placeId,
      });

    return res.status(200).json(
      result,
    );
  } catch (error) {
    return next(error);
  }
}