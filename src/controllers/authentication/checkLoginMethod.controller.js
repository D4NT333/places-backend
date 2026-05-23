import { auth } from "../../config/firebase.js";

function normalizeProvider(providerId) {
  if (providerId === "google.com") return "google";
  if (providerId === "password") return "password";
  return "unknown";
}

function getProviderLabel(provider) {
  if (provider === "google") return "Google";
  if (provider === "password") return "correo y contraseña";
  return "otro método";
}

function getMainProviderFromUserRecord(userRecord) {
  const providerIds = userRecord.providerData?.map(
    (provider) => provider.providerId
  ) || [];

  if (providerIds.includes("google.com")) {
    return "google";
  }

  if (providerIds.includes("password")) {
    return "password";
  }

  return "unknown";
}

export async function checkLoginMethodController(req, res) {
  try {
    const { email, requestedProvider } = req.body;

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({
        ok: false,
        message: "El correo es obligatorio.",
      });
    }

    if (!["password", "google"].includes(requestedProvider)) {
      return res.status(400).json({
        ok: false,
        message: "Método de autenticación inválido.",
      });
    }

    let userRecord;

    try {
      userRecord = await auth.getUserByEmail(cleanEmail);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        return res.status(200).json({
          ok: true,
          exists: false,
          allowed: true,
          currentProvider: null,
          requestedProvider,
          message: "La cuenta no existe.",
        });
      }

      throw error;
    }

    const currentProvider = getMainProviderFromUserRecord(userRecord);
    const allowed = currentProvider === requestedProvider;

    if (!allowed) {
      return res.status(200).json({
        ok: true,
        exists: true,
        allowed: false,
        currentProvider,
        requestedProvider,
        message: `Esta cuenta ya existe, pero fue creada con ${getProviderLabel(
          currentProvider
        )}. Inicia sesión con ${getProviderLabel(currentProvider)}.`,
      });
    }

    return res.status(200).json({
      ok: true,
      exists: true,
      allowed: true,
      currentProvider,
      requestedProvider,
      message: "Método de inicio de sesión permitido.",
    });
  } catch (error) {
    console.log("Error checkLoginMethodController:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo verificar el método de inicio de sesión.",
    });
  }
}