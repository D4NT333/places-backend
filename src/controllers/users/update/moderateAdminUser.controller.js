import moderateAdminUserService from "../../../services/users/update/moderateAdminUser.service.js";

export default async function moderateAdminUserController(
  req,
  res,
) {
  try {
    const {
      userId,
    } = req.params;

    const {
      moderationType,
      reason,
      reasonLabel,
      message,
    } = req.body;

    const result =
      await moderateAdminUserService({
        userId,

        moderationType,
        reason,
        reasonLabel,
        message,

        adminUid:
          req.user?.uid,
      });

    return res
      .status(200)
      .json({
        message:
          result.resultingStatus ===
          "banned"
            ? "Usuario bloqueado permanentemente."
            : "Advertencia aplicada correctamente.",

        ...result,
      });
  } catch (error) {
    console.error(
      "Error moderating admin user:",
      error,
    );

    return res
      .status(
        error.statusCode || 500,
      )
      .json({
        ok: false,

        message:
          error.message ||
          "No se pudo moderar al usuario.",
      });
  }
}