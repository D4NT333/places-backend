import getPlaceReviewsService
  from "../../services/places/read/getPlaceReviews.service.js";

export default async function getPlaceReviewsController(
  req,
  res,
  next
) {
  try {
    const result =
      await getPlaceReviewsService({
        placeId:
          req.params.placeId,

        uid:
          req.user?.uid,

        limit:
          req.query.limit,

        cursor:
          req.query.cursor,
      });

    return res
      .status(200)
      .json(result);
  } catch (error) {
    return next(error);
  }
}