import express from "express";
import cors from "cors";
import placesRoutes from "../routes/places.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/ping", (req, res) => {
  res.json({ ok: true, message: "pong 🏓" });
});

app.use("/api", placesRoutes);

export default app;
