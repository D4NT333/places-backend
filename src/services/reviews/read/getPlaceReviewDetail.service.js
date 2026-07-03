import admin from "firebase-admin";

const db = admin.firestore();

export default async function getPlaceReviewDetailService({ placeId, reviewId }) {
  if (!placeId || !reviewId) {
    const error = new Error("Faltan datos para obtener la reseña.");
    error.statusCode = 400;
    throw error;
  }

  const reviewRef = db.collection("placeReviews").doc(reviewId);
  const reviewSnap = await reviewRef.get();

  if (!reviewSnap.exists) {
    const error = new Error("La reseña no existe.");
    error.statusCode = 404;
    throw error;
  }

  const reviewData = reviewSnap.data();

  if (reviewData.placeId !== placeId) {
    const error = new Error("La reseña no pertenece a este lugar.");
    error.statusCode = 400;
    throw error;
  }

  if (reviewData.deletedAt || reviewData.status !== "published") {
    const error = new Error("La reseña no está disponible.");
    error.statusCode = 404;
    throw error;
  }

  return {
    id: reviewSnap.id,
    placeId: reviewData.placeId,
    placeName: reviewData.placeName || "",

    userId: reviewData.userId || "",
    userName: reviewData.userName || "Usuario",
    userPhoto: reviewData.userPhoto || null,

    rating: Number(reviewData.rating || 0),
    recommended: Boolean(reviewData.recommended),

    commentText: reviewData.commentText || "",
    hasDetails: Boolean(reviewData.hasDetails),

    answers: Array.isArray(reviewData.answers)
      ? reviewData.answers.map((answer) => ({
          questionId: answer.questionId || "",
          questionText: answer.questionText || "",
          label: answer.label || "",
          value: Number(answer.value || 0),
        }))
      : [],

    tagId: reviewData.tagId || "",
    tagLabel: reviewData.tagLabel || "",

    reportCount: Number(reviewData.reportCount || 0),

    createdAt: reviewData.createdAt?.toDate
      ? reviewData.createdAt.toDate().toISOString()
      : null,

    updatedAt: reviewData.updatedAt?.toDate
      ? reviewData.updatedAt.toDate().toISOString()
      : null,
  };
}