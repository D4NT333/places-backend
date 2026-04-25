import express from "express";
import cors from "cors";
import placesRoutes from "../routes/places/places.routes.js";
import feedRoutes from "../routes/feed/feed.routes.js";
import authenticationRoutes from "../routes/authentication/authentication.routes.js";
import placeSubmissionRoutes from "../routes/submissions/placeSubmissions.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/places/add", placesRoutes);

app.use("/api/feed", feedRoutes);

app.use("/api/auth", authenticationRoutes);

app.use("/api", placeSubmissionRoutes);

export default app;

