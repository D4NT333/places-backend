import getDescriptionSubmissionsService from "../../../../services/submissions/description/read/getDescriptionSubmissions.service.js";

export default async function getDescriptionSubmissionsController(req, res, next) {
  try {
    const {
      status = "all",
      limit,
      cursor = null,
    } = req.query;

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const result = await getDescriptionSubmissionsService({
      status,
      limit,
      cursor,
      baseUrl,
    });

    return res.status(200).json({
      ok: true,
      count: Array.isArray(result.items)
        ? result.items.length
        : 0,
      items: result.items || [],
      nextCursor: result.nextCursor || null,
    });
  } catch (error) {
    next(error);
  }
}