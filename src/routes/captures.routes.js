import express from "express";
import Joi from "joi";
import { jwtMiddleware } from "../utils/jwt.js";
import { asyncHandler } from "../utils/async.js";
import { getGameClips, getScreenshots } from "../services/xbox.service.js";
import { badRequest } from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Captures
 *     description: Gameclips & Screenshots
 */

/**
 * @swagger
 * /captures/clips:
 *   get:
 *     summary: Gameclips des Users
 *     tags: [Captures]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: titleId
 *         schema: { type: string }
 *       - in: query
 *         name: max
 *         schema: { type: integer, default: 24 }
 *       - in: query
 *         name: since
 *         description: ISO Datum/Zeitschwelle
 *         schema: { type: string }
 *       - in: query
 *         name: continuationToken
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Clips
 */
router.get("/clips", jwtMiddleware, asyncHandler(async (req, res) => {
    const { xuid } = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const schema = Joi.object({
        titleId: Joi.string().optional(),
        max: Joi.number().integer().min(1).max(100).default(24),
        since: Joi.date().iso().optional(),
        continuationToken: Joi.string().optional()
    });
    const { value, error } = schema.validate(req.query);
    if (error) throw badRequest(error.message);
    const data = await getGameClips(xuid, xboxliveToken, value);
    res.json(data);
}));

/**
 * @swagger
 * /captures/screenshots:
 *   get:
 *     summary: Screenshots des Users
 *     tags: [Captures]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: titleId
 *         schema: { type: string }
 *       - in: query
 *         name: max
 *         schema: { type: integer, default: 24 }
 *       - in: query
 *         name: since
 *         schema: { type: string }
 *       - in: query
 *         name: continuationToken
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Screenshots
 */
router.get("/screenshots", jwtMiddleware, asyncHandler(async (req, res) => {
    const { xuid } = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const schema = Joi.object({
        titleId: Joi.string().optional(),
        max: Joi.number().integer().min(1).max(100).default(24),
        since: Joi.date().iso().optional(),
        continuationToken: Joi.string().optional()
    });
    const { value, error } = schema.validate(req.query);
    if (error) throw badRequest(error.message);
    const data = await getScreenshots(xuid, xboxliveToken, value);
    res.json(data);
}));

export default router;
