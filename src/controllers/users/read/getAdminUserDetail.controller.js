import getAdminUserDetailService from "../../../services/users/read/getAdminUserDetail.service.js";

export default async function getAdminUserDetailController(req, res) {
  try {
    const { userId } = req.params;
    const weekStart = req.query.weekStart || null;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: "Falta el id del usuario.",
      });
    }

    const result = await getAdminUserDetailService({
      userId,
      weekStart,
    });

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error("Error getting admin user detail:", error);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      ok: false,
      message:
        error.message || "No se pudo obtener el detalle del usuario.",
    });
  }
}