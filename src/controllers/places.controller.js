import { db } from "../config/firebase.js";

export async function getPlaces(req, res) {
  try {
    const snapshot = await db.collection("lugares").get();

    const places = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      ok: true,
      places,
    });
  } catch (error) {
    console.error("🔥 Firestore error:", error);
    res.status(500).json({
      ok: false,
      message: "Error leyendo lugares",
    });
  }
}
