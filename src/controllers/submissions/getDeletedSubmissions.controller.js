import getDeletedSubmissionsService from "../../services/submissions/getDeletedSubmissions.service.js";

export default async function getDeletedSubmissionsController(
  req,
  res,
  next
) {
  try {
    const result =
      await getDeletedSubmissionsService({
        limit: req.query.limit,
        cursor: req.query.cursor,
      });

    return res.status(200).json({
      success: true,

      message:
        "Propuestas eliminadas obtenidas correctamente.",

      data: result,
    });
  } catch (error) {
    return next(error);
  }
}