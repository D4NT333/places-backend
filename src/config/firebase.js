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
} = process.env;

console.log("ENV PATH:", envPath);
console.log("PROJECT_ID:", FIREBASE_PROJECT_ID);
console.log("CLIENT_EMAIL exists:", !!FIREBASE_CLIENT_EMAIL);
console.log("PRIVATE_KEY exists:", !!FIREBASE_PRIVATE_KEY);

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  throw new Error("Faltan variables de entorno de Firebase");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

export const firebaseAdmin = admin;
export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;