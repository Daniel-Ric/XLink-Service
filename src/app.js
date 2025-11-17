import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import chalk from "chalk";

import {env} from "./config/env.js";
import {swaggerSpec} from "./utils/swagger.js";

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

import {errorHandler, notFoundHandler} from "./middleware/error.js";

const app = express();
app.set("trust proxy", env.TRUST_PROXY);

const mutePaths = ["/healthz", "/readyz", "/api-docs", "/api-docs/", "/api-docs/swagger-ui.css", "/api-docs/swagger-ui-bundle.js", "/api-docs/swagger-ui-standalone-preset.js", "/api-docs/favicon-32x32.png", "/api-docs/favicon-16x16.png", "/openapi.json"];

function badge(status) {
    if (status >= 500) return chalk.bgRed.black(" ERR ");
    if (status >= 400) return chalk.bgYellow.black(" WARN ");
    return chalk.bgGreen.black(" OK ");
}

function colorMethod(m) {
    switch (m) {
        case "GET":
            return chalk.cyan.bold(m);
        case "POST":
            return chalk.green.bold(m);
        case "PUT":
            return chalk.magenta.bold(m);
        case "PATCH":
            return chalk.yellow.bold(m);
        case "DELETE":
            return chalk.red.bold(m);
        default:
            return chalk.white.bold(m);
    }
}

function colorStatus(code) {
    if (code >= 500) return chalk.red(code);
    if (code >= 400) return chalk.yellow(code);
    if (code >= 300) return chalk.blue(code);
    return chalk.green(code);
}

function colorTime(ms) {
    if (ms < 200) return chalk.green(`${ms}ms`);
    if (ms < 1000) return chalk.yellow(`${ms}ms`);
    return chalk.red(`${ms}ms`);
}

function timestamp() {
    return chalk.gray(new Date().toISOString().split("T")[1].split(".")[0]);
}

app.use((req, res, next) => {
    const id = req.headers["x-correlation-id"] || req.headers["x-request-id"] || crypto.randomUUID();
    req.id = id;
    res.setHeader("X-Request-Id", id);
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const url = req.url || "/";
        if (mutePaths.some(p => url === p || url.startsWith(p + "/"))) return;
        const ms = Number((process.hrtime.bigint() - start) / 1000000n);
        if (env.LOG_PRETTY) {
            const line = [timestamp(), badge(res.statusCode), colorMethod(req.method || "GET"), chalk.white(url), colorStatus(res.statusCode), colorTime(ms), chalk.dim(`#${id.slice(0, 6)}`)].join(" ");
            console.log(line);
        } else {
            console.log(`${new Date().toISOString()} ${req.method} ${url} ${res.statusCode} ${ms}ms ${id}`);
        }
    });
    next();
});

const allowlist = (env.CORS_ORIGIN || "*").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowlist.includes("*") || allowlist.includes(origin)) return cb(null, true);
        cb(new Error("CORS not allowed"));
    }, credentials: true
}));

app.use(helmet({contentSecurityPolicy: false, crossOriginResourcePolicy: {policy: "cross-origin"}}));
app.use(express.json({limit: "1mb"}));
app.use(compression());
app.use(rateLimit({windowMs: 60000, max: 600, standardHeaders: true, legacyHeaders: false}));

if (env.SWAGGER_ENABLED) {
    app.get("/openapi.json", (req, res) => res.json(swaggerSpec));
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        explorer: true,
        swaggerOptions: {
            tagsSorter: "none",
            operationsSorter: (a, b) => {
                const pathOrder = [
                    "/auth/device",
                    "/auth/callback",
                    "/auth/whoami",
                    "/auth/jwt/refresh"
                ];

                const aPath = a.get("path");
                const bPath = b.get("path");

                const aIndex = pathOrder.indexOf(aPath);
                const bIndex = pathOrder.indexOf(bPath);

                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;

                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;

                return aPath.localeCompare(bPath);
            }
        }
    }));
}

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
if (env.NODE_ENV !== "production") app.use("/debug", debugRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
