import { auth, db, FieldValue } from "../../config/firebase.js";

function calculateAgeFromIsoDate(isoDate) {
  const birthDate = new Date(`${isoDate}T00:00:00`);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

export async function registerEmailUserController(req, res) {
  try {
    const { idToken, name, birthDate } = req.body;

    if (!idToken) {
      return res.status(401).json({
        message: "Token requerido.",
      });
    }

    const cleanName = String(name || "").trim();

    if (cleanName.length < 3) {
      return res.status(400).json({
        message: "El nombre debe tener al menos 3 caracteres.",
      });
    }

    if (!birthDate) {
      return res.status(400).json({
        message: "La fecha de nacimiento es obligatoria.",
      });
    }

    const age = calculateAgeFromIsoDate(birthDate);

    if (age < 14) {
      return res.status(400).json({
        message: "Debes tener al menos 14 años para crear una cuenta.",
      });
    }

    const decodedToken = await auth.verifyIdToken(idToken);

    const uid = decodedToken.uid;
    const email = decodedToken.email || null;

    if (!email) {
      return res.status(400).json({
        message: "El token no contiene correo.",
      });
    }

    /**
     * Esto NO guarda nada en Firestore.
     * Esto actualiza Firebase Auth para que el correo de verificación
     * pueda usar el nombre del usuario.
     */
    await auth.updateUser(uid, {
      displayName: cleanName,
    });

    const userRef = db.collection("user").doc(uid);
    const userSnap = await userRef.get();

    const now = FieldValue.serverTimestamp();

    const userPayload = {
      uid,
      name: cleanName,
      birthDate,
      photoURL: null,
      provider: "password",
      emailVerified: false,
      status: "pending_email_verification",
      updatedAt: now,
      lastLoginAt: now,
    };

    if (!userSnap.exists) {
      userPayload.createdAt = now;
    }

    await userRef.set(userPayload, { merge: true });

    return res.status(201).json({
      message: "Usuario registrado correctamente.",
      user: {
        uid,
        name: cleanName,
        birthDate,
        photoURL: null,
        provider: "password",
        emailVerified: false,
        status: "pending_email_verification",
      },
    });
  } catch (error) {
    console.log("Error registerEmailUserController:", error);

    return res.status(500).json({
      message: "No se pudo registrar el usuario.",
    });
  }
}