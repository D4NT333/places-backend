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

    return res.status(200).json({
      ok: true,
      admin: {
        uid: authUser.uid,
        email: adminData.email || authUser.email,
        displayName: adminData.displayName || authUser.name || "",
        role: adminData.role || "admin",
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