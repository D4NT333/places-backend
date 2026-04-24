import { firebaseAdmin } from "../../config/firebase.js";
import createPlaceSubmissionService from "../../services/submissions/create/createPlaceSubmission.service.js";

export default async function createPlaceSubmissionController(req, res) {
  try {
    const authHeader = req.headers.authorization || "";

    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!idToken) {
      return res.status(401).json({
        ok: false,
        message: "Token no proporcionado.",
      });
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const result = await createPlaceSubmissionService({
      payload: req.body,
      uid,
    });

    return res.status(201).json({
      ok: true,
      message: "Place submission creada correctamente.",
      data: result,
    });
  } catch (error) {
    console.error("createPlaceSubmissionController error:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo crear la place submission.",
    });
  }
}