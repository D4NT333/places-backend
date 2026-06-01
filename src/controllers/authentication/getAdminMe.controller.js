import { db } from "../../config/firebase.js";

export default async function getAdminMeController(req, res) {
  try {
    const authUser = req.user;

    if (!authUser?.uid) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado.",
      });
    }

    const adminRef = db.collection("adminUsers").doc(authUser.uid);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return res.status(403).json({
        ok: false,
        message: "No tienes acceso al panel administrativo.",
      });
    }

    const adminData = adminDoc.data();

    if (adminData.isActive !== true) {
      return res.status(403).json({
        ok: false,
        message: "Tu cuenta de administrador está desactivada.",
      });
    }

    const authEmail = String(authUser.email || "").toLowerCase().trim();
    const adminEmail = String(adminData.email || "").toLowerCase().trim();

    if (!authEmail || !adminEmail || authEmail !== adminEmail) {
      return res.status(403).json({
        ok: false,
        message: "La cuenta autenticada no coincide con el administrador registrado.",
      });
    }

    const role = adminData.role || "admin";

    if (!["admin", "super_admin"].includes(role)) {
      return res.status(403).json({
        ok: false,
        message: "Tu rol no tiene acceso al panel administrativo.",
      });
    }

    return res.status(200).json({
      ok: true,
      admin: {
        uid: authUser.uid,
        email: adminEmail,
        displayName: adminData.displayName || authUser.name || "",
        role,
        isActive: adminData.isActive,
        permissions: adminData.permissions || {},
        photoURL: authUser.picture || null,
      },
    });
  } catch (error) {
    console.error("Error validando administrador:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al validar administrador.",
    });
  }
}