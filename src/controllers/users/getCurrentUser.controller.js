import getCurrentUserService from "../../services/users/getCurrentUser.service.js";

export default async function getCurrentUserController(req, res, next) {
  try {
    const uid = req.user?.uid;

    const user = await getCurrentUserService(uid);

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    next(error);
  }
}