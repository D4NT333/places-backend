import getMyPhotoSubmissionsService from "../../../../services/submissions/photo/read/getMyPhotoSubmissions.service.js";

export default async function getMyPhotoSubmissionsController(
  request,
  response
) {
  try {
    const uid = request.user?.uid;

    if (!uid) {
      return response.status(401).json({
        message: "Usuario no autenticado.",
      });
    }

    const submissions =
      await getMyPhotoSubmissionsService(uid);

    return response.status(200).json({
      submissions,
    });
  } catch (error) {
    console.error(
      "Error al obtener las propuestas de fotografías del usuario:",
      error
    );

    return response.status(500).json({
      message:
        "No fue posible obtener las fotografías añadidas.",
    });
  }
}