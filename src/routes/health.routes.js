import express from "express";

const router = express.Router();

/**
 * @swagger
 * /healthz:
 *   get:
 *     summary: Liveness probe
 *     description: Einfacher Healthcheck, keine Auth nötig.
 *     tags: [Health]
 *     security: []   # überschreibt globales BearerAuth
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/healthz", (_req, res) => res.json({ok: true}));

/**
 * @swagger
 * /readyz:
 *   get:
 *     summary: Readiness probe
 *     description: Readiness/Startup Check, keine Auth nötig.
 *     tags: [Health]
 *     security: []   # überschreibt globales BearerAuth
 *     responses:
 *       200:
 *         description: Ready
 */
router.get("/readyz", (_req, res) => res.json({ready: true}));

export default router;
