import { db } from "../../../config/firebase.js";
import getUsersMapByIdsService from "./getUsersMapByIds.service.js";

const VALID_STATUSES = [
  "all",
  "in_review",
  "approved",
  "returned",
  "rejected",
];

function normalizeLimit(limit) {
  const parsedLimit = Number(limit);

  if (Number.isNaN(parsedLimit)) {
    return 15;
  }

  return Math.min(Math.max(parsedLimit, 1), 30);
}

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return null;
  }

  return timestamp.toDate().toISOString();
}

function getFirstPhotoUrl(photos = []) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return null;
  }

  return photos[0]?.downloadURL || null;
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

export default async function listPlaceSubmissionsService({
  status = "all",
  limit = 15,
  cursor = null,
}) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Estado de submission inválido.");
  }

  const finalLimit = normalizeLimit(limit);

  console.log("========== LIST PLACE SUBMISSIONS SERVICE ==========");
  console.log("Status recibido:", status);
  console.log("Limit recibido:", limit);
  console.log("Limit final:", finalLimit);
  console.log("Cursor recibido:", cursor);

  let query = db
    .collection("placeSubmissions")
    .orderBy("createdAt", "desc")
    .limit(finalLimit);

  if (status !== "all") {
    query = db
      .collection("placeSubmissions")
      .where("status", "==", status)
      .orderBy("createdAt", "desc")
      .limit(finalLimit);
  }

  if (cursor) {
    const cursorDoc = await db
      .collection("placeSubmissions")
      .doc(cursor)
      .get();

    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();

  const submissions = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  console.log("Submissions encontradas:", submissions.length);

  const userIds = submissions.map((submission) => submission.createdBy);

  console.log("User IDs encontrados:", userIds);

  const usersMap = await getUsersMapByIdsService(userIds);

  console.log("Usuarios encontrados:", Object.keys(usersMap).length);

  const items = submissions.map((submission) => {
    const user = usersMap[submission.createdBy];
    return {
      id: submission.id,
      placeSubmissionId: submission.placeSubmissionId || submission.id,

      name: submission.name || "Lugar sin nombre",
      status: submission.status || "unknown",
      createdAt: formatTimestamp(submission.createdAt),

      userId: submission.createdBy || null,
      userName: mapUserDisplayName(user),
      userPhotoUrl: mapUserPhotoUrl(user),

      placePhotoUrl: getFirstPhotoUrl(submission.photos),

      reviewCycle: submission.reviewCycle || 1,
      wasReturnedBefore: Boolean(submission.wasReturnedBefore),
    };
  });

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  const nextCursor = lastDoc ? lastDoc.id : null;

  console.log("Items finales:", items.length);
  console.log("Next cursor:", nextCursor);
  console.log("====================================================");

  return {
    items,
    nextCursor,
  };
}