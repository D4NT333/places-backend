import { db } from "../../../config/firebase.js";

const CANDIDATES_COLLECTION = "candidatesPlaces";

const VALID_STATUSES = ["all", "in_review", "accepted", "rejected"];

function normalizeLimit(limit) {
  const parsed = Number(limit);

  if (!Number.isFinite(parsed)) return 15;

  return Math.min(Math.max(parsed, 1), 30);
}

function normalizeStatus(status) {
  if (!status) return "in_review";

  return VALID_STATUSES.includes(status) ? status : "in_review";
}

function formatTimestamp(timestamp) {
  if (!timestamp) return null;

  if (typeof timestamp.toDate === "function") {
    return timestamp.toDate().toISOString();
  }

  return null;
}

function mapCandidateDoc(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    googlePlaceId: data.googlePlaceId || doc.id,

    // Snapshot soft guardado al importar.
    name: data.name || "Sin nombre",
    address: data.address || "Sin dirección",
    googleMainType: data.googleMainType || "Sin tipo",
    types: Array.isArray(data.types) ? data.types : [],

    status: data.status || "in_review",
    source: data.source || "google",
    parentHexId: data.parentHexId || null,
    importedBy: data.importedBy || null,

    googleDataFetchedAt: formatTimestamp(data.googleDataFetchedAt),
    googleDataExpiresAt: formatTimestamp(data.googleDataExpiresAt),

    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
}

export default async function listGooglePlaceCandidatesService({
  status = "in_review",
  limit = 15,
  cursor = null,
} = {}) {
  const normalizedStatus = normalizeStatus(status);
  const normalizedLimit = normalizeLimit(limit);

  let query = db.collection(CANDIDATES_COLLECTION);

  if (normalizedStatus !== "all") {
    query = query.where("status", "==", normalizedStatus);
  }

  query = query.orderBy("createdAt", "desc").limit(normalizedLimit);

  if (cursor) {
    const cursorDoc = await db
      .collection(CANDIDATES_COLLECTION)
      .doc(cursor)
      .get();

    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();

  const items = snapshot.docs.map(mapCandidateDoc);

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];

  return {
    items,
    nextCursor: lastDoc ? lastDoc.id : null,
    hasMore: items.length === normalizedLimit,
    status: normalizedStatus,
    limit: normalizedLimit,
  };
}