import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env.js";
import { swaggerSpec } from "./utils/swagger.js";

import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import achievementsRoutes from "./routes/achievements.routes.js";
import presenceRoutes from "./routes/presence.routes.js";
import minecraftRoutes from "./routes/minecraft.routes.js";
import healthRoutes from "./routes/health.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import lookupRoutes from "./routes/lookup.routes.js";

import playfabRoutes from "./routes/playfab.routes.js";
import peopleRoutes from "./routes/people.routes.js";
import capturesRoutes from "./routes/captures.routes.js";
import titlesRoutes from "./routes/titles.routes.js";
import debugRoutes from "./routes/debug.routes.js";

import { notFoundHandler, errorHandler } from "./middleware/error.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(compression());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/openapi.json", (req, res) => res.json(swaggerSpec));
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        explorer: true,
        swaggerOptions: { tagsSorter: "none", operationsSorter: "alpha" }
    })
);

app.use("/", healthRoutes);
app.use("/auth", authRoutes);
app.use("/lookup", lookupRoutes);

app.use("/profile", profileRoutes);
app.use("/titles", titlesRoutes);
app.use("/captures", capturesRoutes);
app.use("/people", peopleRoutes);
app.use("/presence", presenceRoutes);

app.use("/achievements", achievementsRoutes);
app.use("/stats", statsRoutes);

app.use("/inventory", inventoryRoutes);
app.use("/playfab", playfabRoutes);
app.use("/minecraft", minecraftRoutes);

app.use("/debug", debugRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
