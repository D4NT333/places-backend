import { FieldValue } from "firebase-admin/firestore";

import { db } from "../../../../config/firebase.js";

import {
  createUserNotificationService,
} from "../../../notifications/createUserNotification.service.js";

import {
  sendPushNotificationToUserService,
} from "../../../notifications/sendPushNotificationToUser.service.js";


function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getUserUid(submissionData = {}) {
  return (
    cleanText(submissionData.createdBy?.uid) ||
    cleanText(submissionData.createdBy) ||
    cleanText(submissionData.uid) ||
    cleanText(submissionData.submittedBy?.uid) ||
    cleanText(submissionData.submittedBy) ||
    cleanText(submissionData.userId) ||
    null
  );
}

function normalizeReviewer(user = {}) {
  return {
    uid: user.uid || null,
    email: user.email || null,
    name: user.name || user.email || "Administrador",
    picture: user.picture || null,
  };
}

async function approveDescriptionSubmissionService({
  submissionId,
  reviewedBy,
}) {
  const cleanSubmissionId = cleanText(submissionId);

  if (!cleanSubmissionId) {
    throw createHttpError(400, "El id de la propuesta es obligatorio.");
  }

  const submissionRef = db
    .collection("descriptionSubmissions")
    .doc(cleanSubmissionId);

  const result = await db.runTransaction(async (transaction) => {
    const submissionSnap = await transaction.get(submissionRef);

    if (!submissionSnap.exists) {
      throw createHttpError(404, "No se encontró la propuesta de descripción.");
    }

    const submissionData = submissionSnap.data();

    if (submissionData.deletedAt) {
      throw createHttpError(
        404,
        "La propuesta de descripción ya no está disponible."
      );
    }

    const status = cleanText(submissionData.status);

    if (status !== "in_review") {
      throw createHttpError(
        409,
        "Solo se pueden aprobar propuestas en estado de revisión."
      );
    }

    const proposedDescription = cleanText(submissionData.proposedDescription);

    if (!proposedDescription) {
      throw createHttpError(
        400,
        "La propuesta no tiene una descripción válida."
      );
    }

    const placeDocId =
      cleanText(submissionData.placeDocId) ||
      cleanText(submissionData.placeId);

    if (!placeDocId) {
      throw createHttpError(
        400,
        "La propuesta no tiene un lugar asociado."
      );
    }

    const placeRef = db.collection("places").doc(placeDocId);
    const placeSnap = await transaction.get(placeRef);

    if (!placeSnap.exists) {
      throw createHttpError(404, "No se encontró el lugar asociado.");
    }

    const placeData = placeSnap.data();

    if (placeData.deletedAt) {
      throw createHttpError(404, "El lugar asociado ya no está disponible.");
    }

    const reviewer = normalizeReviewer(reviewedBy);

    transaction.update(placeRef, {
      description: proposedDescription,

      descriptionUpdatedAt: FieldValue.serverTimestamp(),
      descriptionUpdatedFromSubmissionId: cleanSubmissionId,

      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.update(submissionRef, {
      status: "approved",

      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: reviewer,
      reviewMessage: null,

      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
  submissionId: cleanSubmissionId,
  placeId: placeDocId,
  status: "approved",
  description: proposedDescription,

  createdBy: getUserUid(submissionData),

  placeName:
    cleanText(submissionData.placeName) ||
    cleanText(placeData.name) ||
    "el lugar",
};
  });

  const notificationData = {
  screen: "VisualizedAddedDescriptionScreen",
  type: "description_submission_approved",
  submissionId: result.submissionId,
  placeId: result.placeId,
};

if (result.createdBy) {
  const title = "Tu descripción fue aprobada";

  const body = `Tu propuesta de descripción para “${result.placeName}” fue aprobada.`;

  try {
    const notification =
      await createUserNotificationService({
        uid: result.createdBy,
        type: "description_submission_approved",
        title,
        body,
        data: notificationData,
      });

    const pushResult =
      await sendPushNotificationToUserService({
        uid: result.createdBy,
        title,
        body,
        data: {
          ...notificationData,
          notificationId: notification.id,
        },
      });

    console.log(
      "Notificación de descripción aprobada enviada:",
      {
        submissionId: result.submissionId,
        uid: result.createdBy,
        sent: pushResult.sent,
      },
    );
  } catch (notificationError) {
    console.error(
      "La descripción fue aprobada, pero falló la notificación:",
      notificationError,
    );
  }
}

return {
  submissionId: result.submissionId,
  placeId: result.placeId,
  status: result.status,
  description: result.description,
};
}

export default approveDescriptionSubmissionService;