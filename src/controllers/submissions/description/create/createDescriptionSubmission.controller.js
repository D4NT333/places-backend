import createDescriptionSubmissionService from "../../../../services/submissions/description/create/createDescriptionSubmission.service.js";

export default async function createDescriptionSubmissionController(req, res, next) {
  try {
    const { placeId } = req.params;
    const { proposedDescription } = req.body;

    const submission = await createDescriptionSubmissionService({
      placeId,
      proposedDescription,
      user: req.user,
    });

    return res.status(201).json({
      ok: true,
      message: "Propuesta de descripción enviada correctamente.",
      submission,
    });
  } catch (error) {
    next(error);
  }
}