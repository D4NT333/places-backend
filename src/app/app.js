import express from "express";
import cors from "cors";
import placesRoutes from "../routes/places.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/places", placesRoutes);

export default app;

