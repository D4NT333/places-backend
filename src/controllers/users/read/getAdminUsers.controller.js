import getAdminUsersService from "../../../services/users/read/getAdminUsers.service.js";

export default async function getAdminUsersController(req, res) {
  try {
    const limit = Number(req.query.limit) || 15;
    const cursor = req.query.cursor || null;
    const status = req.query.status || "all";

    const result = await getAdminUsersService({
      limit,
      cursor,
      status,
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Error getting admin users:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudieron obtener los usuarios.",
    });
  }
}