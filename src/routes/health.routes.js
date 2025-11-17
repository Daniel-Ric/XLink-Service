import express from "express";

const router = express.Router();

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
 *       Currently a simple `{ ready: true }` response without deep dependency checks.
 *       No authentication required.
 *     tags: [Health]
 *     security: []   # overrides global BearerAuth
 *     responses:
 *       200:
 *         description: Service is ready to receive traffic
 */
router.get("/readyz", (_req, res) => res.json({ready: true}));

export default router;
