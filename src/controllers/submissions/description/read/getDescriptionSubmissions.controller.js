import getDescriptionSubmissionsService from "../../../../services/submissions/description/read/getDescriptionSubmissions.service.js";

export default async function getDescriptionSubmissionsController(req, res, next) {
  try {
    const { status, limit } = req.query;

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const submissions = await getDescriptionSubmissionsService({
      status,
      limit,
      baseUrl,
    });

    return res.status(200).json({
      ok: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    next(error);
  }
}