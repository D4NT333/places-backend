import express from "express";
import cors from "cors";
import placesRoutes from "../routes/places/places.routes.js";
import feedRoutes from "../routes/feed/feed.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/places/add", placesRoutes);

app.use("/api/feed", feedRoutes);

export default app;

