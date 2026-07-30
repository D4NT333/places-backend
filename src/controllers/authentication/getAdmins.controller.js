import getAdminsService from "../../services/auth/getAdmins.service.js";

export default async function getAdminsController(
  req,
  res,
  next,
) {
  try {
    const {
      filter = "all",
      limit,
      cursor = null,
    } = req.query;

    const result =
      await getAdminsService({
        requesterUid:
          req.user.uid,

        filter,
        limit,
        cursor,
      });

    return res.status(200).json({
      ok: true,

      count:
        Array.isArray(
          result.items,
        )
          ? result.items.length
          : 0,

      items:
        result.items || [],

      summary:
        result.summary || {
          total: 0,
          active: 0,
          disabled: 0,
          admins: 0,
          superAdmins: 0,
          activeSuperAdmins: 0,
        },

      nextCursor:
        result.pagination
          ?.nextCursor ||
        null,

      hasMore:
        result.pagination
          ?.hasMore === true,

      limit:
        result.pagination
          ?.limit ||
        15,
    });
  } catch (error) {
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({
          ok: false,
          message:
            error.message ||
            "No fue posible consultar los administradores.",
        });
    }

    return next(error);
  }
}