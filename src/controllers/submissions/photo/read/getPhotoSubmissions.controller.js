import getPhotoSubmissionsService from "../../../../services/submissions/photo/read/getPhotoSubmissions.service.js";

export default async function getPhotoSubmissionsController(
  req,
  res
) {
  try {
    const {
      status = "all",
      limit = 15,
      cursor = "",
    } = req.query;

    const result =
      await getPhotoSubmissionsService({
        status,
        limit,
        cursor,
      });

    return res.status(200).json({
      submissions:
        result.submissions,

      pagination:
        result.pagination,
    });
  } catch (error) {
    console.error(
      "Error obteniendo propuestas de fotografías:",
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        message:
          error.statusCode
            ? error.message
            : "No se pudieron obtener las propuestas de fotografías.",
      });
  }
}