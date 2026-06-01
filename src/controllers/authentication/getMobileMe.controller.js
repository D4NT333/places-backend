import getMobileMeService from "../../services/auth/getMobileMe.service.js";

export default async function getMobileMeController(req, res) {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado.",
      });
    }

    const result = await getMobileMeService({ uid });

    return res.status(200).json({
      ok: true,
      user: result.user,
    });
  } catch (error) {
    console.error("Error en getMobileMeController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudo obtener la información del usuario.",
    });
  }
}