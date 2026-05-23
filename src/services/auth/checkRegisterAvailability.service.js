import { auth, db } from "../../config/firebase.js";

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function checkEmailExists(email) {
  if (!email) return false;

  try {
    await auth.getUserByEmail(email);
    return true;
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      return false;
    }

    throw error;
  }
}

async function checkNameExists(name) {
  if (!name) return false;

  const snapshot = await db
    .collection("user")
    .where("name", "==", name)
    .limit(1)
    .get();

  return !snapshot.empty;
}

export default async function checkRegisterAvailabilityService({ email, name }) {
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(name || "").trim();

  const [emailExists, nameExists] = await Promise.all([
    checkEmailExists(cleanEmail),
    checkNameExists(cleanName),
  ]);

  return {
    email: cleanEmail,
    name: cleanName,

    emailExists,
    nameExists,

    emailAvailable: !emailExists,
    nameAvailable: !nameExists,
  };
}