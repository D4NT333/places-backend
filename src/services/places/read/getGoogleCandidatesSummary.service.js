import { db } from "../../../config/firebase.js";

const CANDIDATES_COLLECTION = "candidatesPlaces";

export default async function getGoogleCandidatesSummaryService() {
  const inReviewSnapshot = await db
    .collection(CANDIDATES_COLLECTION)
    .where("status", "==", "in_review")
    .limit(1)
    .get();

  const hasPendingCandidates = !inReviewSnapshot.empty;

  return {
    hasPendingCandidates,
    shouldShowMap: !hasPendingCandidates,
  };
}