import { firebaseAdmin } from "../../config/firebase.js";
import createOrUpdateUserService from "../../services/auth/createOrUpdateUser.service.js";

export default async function createSessionController(req, res) {
  try {
    const authHeader = req.headers.authorization || "";

    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.split("Bearer ")[1]
      : null;

    if (!idToken) {
      return res.status(401).json({
        ok: false,
        message: "Token no proporcionado.",
      });
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);

    const user = await createOrUpdateUserService({ decodedToken });

    return res.status(200).json({
      ok: true,
      message: "Sesión sincronizada correctamente.",
      user,
    });
  } catch (error) {
    console.error("createSessionController error:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo sincronizar la sesión.",
    });
  }
}