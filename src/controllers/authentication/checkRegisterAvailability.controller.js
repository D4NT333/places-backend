import checkRegisterAvailabilityService from "../../services/auth/checkRegisterAvailability.service.js";

export default async function checkRegisterAvailabilityController(req, res) {
  try {
    const { email, name } = req.body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanName = String(name || "").trim();

    if (!cleanEmail && !cleanName) {
      return res.status(400).json({
        message: "Se requiere correo o nombre para validar disponibilidad.",
      });
    }

    const result = await checkRegisterAvailabilityService({
      email: cleanEmail,
      name: cleanName,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.log("Error checkRegisterAvailabilityController:", error);

    return res.status(500).json({
      message: "No se pudo validar la disponibilidad del registro.",
    });
  }
}