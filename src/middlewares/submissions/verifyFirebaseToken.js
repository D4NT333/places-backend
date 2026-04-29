import { auth } from "../../config/firebase.js";

export default async function verifyFirebaseToken(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        message: "Token de autorización no enviado.",
      });
    }

    const token = authorizationHeader.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Token inválido.",
      });
    }

    const decodedToken = await auth.verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
    };

    return next();
  } catch (error) {
    console.error("Error al verificar token de Firebase:", error);

    return res.status(401).json({
      ok: false,
      message: "No autorizado.",
    });
  }
}