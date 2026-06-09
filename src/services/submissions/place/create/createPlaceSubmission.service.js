import { db, FieldValue } from "../../../../config/firebase.js";

export default async function createPlaceSubmissionService({ payload, uid }) {
  console.log("========== PLACE SUBMISSION RECIBIDA ==========");
  console.log(JSON.stringify(payload, null, 2));
  console.log("===============================================");

  const submissionToSave = {
    ...payload,
    createdBy: uid,
    source: "mobile",
    status: "in_review",
    createdAt: FieldValue.serverTimestamp(),
  };

  await db
    .collection("placeSubmissions")
    .doc(payload.placeSubmissionId)
    .set(submissionToSave);

  return {
    id: payload.placeSubmissionId,
    ...submissionToSave,
  };
}