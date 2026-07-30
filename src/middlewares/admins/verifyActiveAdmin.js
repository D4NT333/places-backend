import {
  db,
} from "../../config/firebase.js";

const ADMIN_USERS_COLLECTION =
  "adminUsers";

export default async function verifyActiveAdmin(
  req,
  res,
  next,
) {
  try {
    const uid =
      req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        ok: false,
        message:
          "No se pudo identificar al usuario autenticado.",
      });
    }

    const adminDoc = await db
      .collection(
        ADMIN_USERS_COLLECTION,
      )
      .doc(uid)
      .get();

    if (!adminDoc.exists) {
      return res.status(403).json({
        ok: false,
        message:
          "La cuenta no pertenece al panel administrativo.",
      });
    }

    const adminData =
      adminDoc.data() || {};

    if (
      adminData.isActive !== true
    ) {
      return res.status(403).json({
        ok: false,
        message:
          "La cuenta administrativa está desactivada.",
      });
    }

    const validRole =
      adminData.role === "admin" ||
      adminData.role ===
        "super_admin";

    if (!validRole) {
      return res.status(403).json({
        ok: false,
        message:
          "La cuenta no tiene un rol administrativo válido.",
      });
    }

    req.admin = {
      uid,

      displayName:
        typeof adminData.displayName ===
        "string"
          ? adminData.displayName.trim()
          : "",

      email:
        typeof adminData.email ===
        "string"
          ? adminData.email.trim()
          : "",

      role:
        adminData.role,

      isActive:
        true,

      permissions:
        adminData.permissions || {},
    };

    return next();
  } catch (error) {
    console.error(
      "Error verificando administrador activo:",
      error,
    );

    return res.status(500).json({
      ok: false,
      message:
        "No fue posible verificar el acceso administrativo.",
    });
  }
}