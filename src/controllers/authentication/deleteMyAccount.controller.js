import deleteMyAccountService from "../../services/auth/deleteMyAccount.service.js";

export default async function deleteMyAccountController(req, res) {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado.",
      });
    }

    const { confirmPermanentDelete } = req.body || {};

    if (confirmPermanentDelete !== true) {
      return res.status(400).json({
        ok: false,
        message: "Debes confirmar que deseas eliminar la cuenta permanentemente.",
      });
    }

    const result = await deleteMyAccountService({ uid });

    return res.status(200).json({
      ok: true,
      message: "Cuenta eliminada correctamente.",
      deleted: result.deleted,
    });
  } catch (error) {
    console.error("Error en deleteMyAccountController:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudo eliminar la cuenta.",
    });
  }
}