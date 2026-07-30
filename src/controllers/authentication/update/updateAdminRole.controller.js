import updateAdminRoleService from "../../../services/auth/update/updateAdminRole.service.js";

export default async function updateAdminRoleController(
  req,
  res,
  next,
) {
  try {
    const {
      adminUid,
    } = req.params;

    const {
      role,
    } = req.body;

    const result =
      await updateAdminRoleService({
        requesterUid:
          req.user.uid,

        targetAdminUid:
          adminUid,

        newRole:
          role,
      });

    return res.status(200).json({
      ok: true,

      message:
        "El rol administrativo se actualizó correctamente.",

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