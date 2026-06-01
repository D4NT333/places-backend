import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fuerza la carga del .env desde la raíz del backend
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_STORAGE_BUCKET,
} = process.env;

console.log("ENV PATH:", envPath);
console.log("PROJECT_ID:", FIREBASE_PROJECT_ID);
console.log("CLIENT_EMAIL exists:", !!FIREBASE_CLIENT_EMAIL);
console.log("PRIVATE_KEY exists:", !!FIREBASE_PRIVATE_KEY);
console.log("STORAGE_BUCKET exists:", !!FIREBASE_STORAGE_BUCKET);

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  throw new Error("Faltan variables de entorno de Firebase");
}

if (!admin.apps.length) {
  const firebaseConfig = {
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  };

  if (FIREBASE_STORAGE_BUCKET) {
    firebaseConfig.storageBucket = FIREBASE_STORAGE_BUCKET;
  }

  admin.initializeApp(firebaseConfig);
}

export const firebaseAdmin = admin;
export const db = admin.firestore();
export const auth = admin.auth();
export const FieldValue = admin.firestore.FieldValue;
export const bucket = admin.storage().bucket();