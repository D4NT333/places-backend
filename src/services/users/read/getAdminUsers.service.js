import { db } from "../../../config/firebase.js";

const USER_STATUS = {
  ALL: "all",
  ACTIVE: "active",
  UNDER_OBSERVATION: "under_observation",
  WARNED: "warned",
  BLOCKED: "blocked",
};

const ALLOWED_STATUS_FILTERS = new Set([
  USER_STATUS.ALL,
  USER_STATUS.ACTIVE,
  USER_STATUS.UNDER_OBSERVATION,
  USER_STATUS.WARNED,
  USER_STATUS.BLOCKED,
]);

function serializeDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function getInitials(name = "", email = "") {
  const cleanName = name?.trim();

  if (cleanName) {
    const words = cleanName.split(" ").filter(Boolean);

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  const cleanEmail = email?.trim();

  if (cleanEmail) {
    return cleanEmail.replace(/@.*/, "").slice(0, 2).toUpperCase();
  }

  return "US";
}

function normalizeUserStatus(status) {
  if (
    status === USER_STATUS.ACTIVE ||
    status === USER_STATUS.UNDER_OBSERVATION ||
    status === USER_STATUS.WARNED ||
    status === USER_STATUS.BLOCKED
  ) {
    return status;
  }

  return USER_STATUS.ACTIVE;
}

function normalizeUser(doc) {
  const data = doc.data();

  const name = data.name || "Usuario sin nombre";
  const email = data.email || "Sin correo";

  return {
    id: doc.id,
    uid: data.uid || doc.id,

    name,
    email,
    initials: getInitials(name, email),

    photoURL: data.photoURL || null,
    provider: data.provider || null,

    profile: data.profile || data.profileLabel || "Sin perfil",

    status: normalizeUserStatus(data.status),
    emailVerified: Boolean(data.emailVerified),

    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    lastLoginAt: serializeDate(data.lastLoginAt),

    activity: {
      contributionsCount: data.contributionsCount || 0,
      reportsCount: data.reportsCount || 0,
    },
  };
}

export default async function getAdminUsersService({
  limit = 15,
  cursor = null,
  status = USER_STATUS.ALL,
}) {
  const safeLimit = Math.min(Number(limit) || 15, 30);

  const safeStatus = ALLOWED_STATUS_FILTERS.has(status)
    ? status
    : USER_STATUS.ALL;

  let query = db
    .collection("user")
    .orderBy("createdAt", "desc");

  if (safeStatus !== USER_STATUS.ALL) {
    query = query.where("status", "==", safeStatus);
  }

  query = query.limit(safeLimit + 1);

  if (cursor) {
    const cursorDoc = await db.collection("user").doc(cursor).get();

    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();

  const docs = snapshot.docs.slice(0, safeLimit);
  const extraDoc = snapshot.docs[safeLimit];

  return {
    users: docs.map(normalizeUser),
    count: docs.length,
    status: safeStatus,
    hasMore: Boolean(extraDoc),
    nextCursor: extraDoc ? docs[docs.length - 1]?.id || null : null,
    limit: safeLimit,
  };
}