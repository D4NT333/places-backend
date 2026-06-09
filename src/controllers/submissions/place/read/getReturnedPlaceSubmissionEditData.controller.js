import getReturnedPlaceSubmissionEditDataService from "../../../../services/submissions/place/read/getReturnedPlaceSubmissionEditData.service.js";

export default async function getReturnedPlaceSubmissionEditDataController(
  req,
  res
) {
  try {
    const { submissionId } = req.params;

    const requesterUid =
      req.user?.uid ||
      req.firebaseUser?.uid ||
      req.auth?.uid ||
      null;

    const data = await getReturnedPlaceSubmissionEditDataService({
      submissionId,
      requesterUid,
    });

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    console.log("Error al cargar datos de edición de propuesta:", error);

    return res.status(error.statusCode || 500).json({
      ok: false,
      message:
        error.message ||
        "No se pudieron cargar los datos de edición de la propuesta.",
    });
  }
}