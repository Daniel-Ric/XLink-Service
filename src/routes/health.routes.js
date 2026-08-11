import express from "express";
import {env} from "../config/env.js";
import {getMicrosoftOAuthConfig, isModernMicrosoftClientId} from "../services/microsoft.service.js";

const router = express.Router();

export function getReadinessStatus(config = env) {
    const browserFlowEnabled = Boolean(config.MICROSOFT_OAUTH_REDIRECT_URI) &&
        isModernMicrosoftClientId(config.CLIENT_ID) &&
        getMicrosoftOAuthConfig(config.CLIENT_ID, config.MICROSOFT_AUTH_MODE).type === "modern";
    if (browserFlowEnabled && !config.MICROSOFT_OAUTH_CLIENT_SECRET) {
        return {ready: false, reason: "microsoft_oauth_client_secret_missing"};
    }
    return {ready: true};
}

/**
 * @swagger
 * /healthz:
 *   get:
 *     summary: Liveness probe
 *     description: >
 *       Very lightweight liveness check. Returns `{ ok: true }` if the process is running
 *       and able to accept HTTP requests. No authentication required.
 *     tags: [Health]
 *     security: []   # overrides global BearerAuth
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get("/healthz", (_req, res) => res.json({ok: true}));

/**
 * @swagger
 * /readyz:
 *   get:
 *     summary: Readiness / startup probe
 *     description: >
 *       Readiness check used by orchestrators to decide whether traffic can be routed to this instance.
 *       Validates local configuration required for the configured browser OAuth flow.
 *       No authentication required.
 *     tags: [Health]
 *     security: []   # overrides global BearerAuth
 *     responses:
 *       200:
 *         description: Service is ready to receive traffic
 *       503:
 *         description: Required browser OAuth configuration is missing
 */
router.get("/readyz", (_req, res) => {
    const status = getReadinessStatus();
    res.status(status.ready ? 200 : 503).json(status);
});

export default router;
