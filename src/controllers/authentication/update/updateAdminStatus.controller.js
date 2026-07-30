import updateAdminStatusService from "../../../services/auth/update/updateAdminStatus.service.js";

export default async function updateAdminStatusController(
  req,
  res,
  next,
) {
  try {
    const {
      adminUid,
    } = req.params;

    const {
      action,
      reason = "",
    } = req.body;

    const result =
      await updateAdminStatusService({
        requesterUid:
          req.user.uid,

        targetAdminUid:
          adminUid,

        action,
        reason,
      });

    const message =
      result.isActive
        ? "La cuenta administrativa se reactivó correctamente."
        : "La cuenta administrativa se desactivó correctamente.";

    return res.status(200).json({
      ok: true,
      message,
      admin: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({
          ok: false,
          message:
            error.message,
        });
    }

    return next(error);
  }
}