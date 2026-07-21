import moderateAdminPlaceService from "../../services/places/update/moderateAdminPlace.service.js";

export default async function moderateAdminPlaceController(
  req,
  res,
  next
) {
  try {
    const {
      placeId,
    } = req.params;

    const {
      action,
      note,
    } = req.body;

    const result =
      await moderateAdminPlaceService({
        adminUid:
          req.user?.uid,

        placeId,
        action,
        note,
      });

    return res.status(200).json({
      ok: true,

      message:
        action === "hidden"
          ? "El lugar fue ocultado correctamente."
          : "El lugar fue advertido correctamente.",

      ...result,
    });
  } catch (error) {
    console.error(
      "Error en moderateAdminPlaceController:",
      error
    );

    return next(error);
  }
}