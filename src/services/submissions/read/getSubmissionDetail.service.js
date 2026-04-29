import { db } from "../../../config/firebase.js";

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return null;
  }

  return timestamp.toDate().toISOString();
}

function mapUserDisplayName(user) {
  if (!user) {
    return "Usuario desconocido";
  }

  return (
    user.name ||
    user.displayName ||
    user.username ||
    user.email ||
    "Usuario desconocido"
  );
}

function mapUserPhotoUrl(user) {
  if (!user) {
    return null;
  }

  return user.photoURL || user.photoUrl || user.avatarUrl || null;
}

export default async function getSubmissionDetailService({ submissionId }) {
  if (!submissionId) {
    throw new Error("ID de submission no proporcionado.");
  }

  console.log("========== GET SUBMISSION DETAIL SERVICE ==========");
  console.log("Submission ID recibido:", submissionId);

  const submissionSnapshot = await db
    .collection("placeSubmissions")
    .doc(submissionId)
    .get();

  if (!submissionSnapshot.exists) {
    throw new Error("La submission no existe.");
  }

  const submission = {
    id: submissionSnapshot.id,
    ...submissionSnapshot.data(),
  };

  let user = null;

  if (submission.createdBy) {
    const userSnapshot = await db
      .collection("user")
      .doc(submission.createdBy)
      .get();

    if (userSnapshot.exists) {
      user = {
        id: userSnapshot.id,
        ...userSnapshot.data(),
      };
    }
  }

  console.log("Submission encontrada:", submission.id);
  console.log("Usuario encontrado:", user?.id || null);
  console.log("===================================================");

  return {
    id: submission.id,
    placeSubmissionId: submission.placeSubmissionId || submission.id,

    name: submission.name || "Lugar sin nombre",
    description: submission.description || "",
    status: submission.status || "unknown",

    createdAt: formatTimestamp(submission.createdAt),
    updatedAt: formatTimestamp(submission.updatedAt),

    userId: submission.createdBy || null,
    userName: mapUserDisplayName(user),
    userPhotoUrl: mapUserPhotoUrl(user),

    photos: Array.isArray(submission.photos) ? submission.photos : [],
    location: submission.location || null,

    tagId: submission.tagId || null,
    tagLabel: submission.tagLabel || null,
    
    subtags: Array.isArray(submission.subtags) ? submission.subtags : [],
    approaches: Array.isArray(submission.approaches) ? submission.approaches : [],

    price: submission.price || null,

    reviewCycle: submission.reviewCycle || 1,
    wasReturnedBefore: Boolean(submission.wasReturnedBefore),

    returnReason: submission.returnReason || null,
    rejectionReason: submission.rejectionReason || null,
    reviewHistory: Array.isArray(submission.reviewHistory)
      ? submission.reviewHistory
      : [],
  };
}