import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getGameClips, getScreenshots} from "../services/xbox.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Captures
 *     description: Xbox game captures – game clips and screenshots for the signed-in user.
 */

/**
 * @swagger
 * /captures/clips:
 *   get:
 *     summary: List game clips for the authenticated user
 *     description: >
 *       Returns the user's game clips from the Xbox game-clips metadata service.
 *       You can filter by title, date threshold (`since`) and page through results
 *       using `continuationToken`.
 *     tags: [Captures]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *         description: Xbox Live XSTS token in XBL3.0 format
 *       - in: query
 *         name: titleId
 *         schema: { type: string }
 *         description: Optional titleId to only return clips for a specific game
 *       - in: query
 *         name: max
 *         schema: { type: integer, default: 24 }
 *         description: Maximum number of clips to return (1–100)
 *       - in: query
 *         name: since
 *         description: ISO 8601 timestamp used as lower time bound (only clips created after this moment)
 *         schema: { type: string }
 *       - in: query
 *         name: continuationToken
 *         schema: { type: string }
 *         description: Continuation token from a previous response to page through results
 *     responses:
 *       200:
 *         description: Page of game clips for the user
 */
router.get("/clips", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const schema = Joi.object({
        titleId: Joi.string().optional(),
        max: Joi.number().integer().min(1).max(100).default(24),
        since: Joi.date().iso().optional(),
        continuationToken: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.query);
    if (error) throw badRequest(error.message);
    const data = await getGameClips(xuid, xboxliveToken, value);
    res.json(data);
}));

/**
 * @swagger
 * /captures/screenshots:
 *   get:
 *     summary: List screenshots for the authenticated user
 *     description: >
 *       Returns screenshots from the Xbox screenshots metadata service. Works analogously
 *       to `/captures/clips` with support for filtering by title, date (`since`) and
 *       continuation tokens.
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
 *         description: Optional titleId to restrict screenshots to a specific game
 *       - in: query
 *         name: max
 *         schema: { type: integer, default: 24 }
 *         description: Maximum number of screenshots to return (1–100)
 *       - in: query
 *         name: since
 *         schema: { type: string }
 *         description: Optional ISO 8601 lower bound for capture time
 *       - in: query
 *         name: continuationToken
 *         schema: { type: string }
 *         description: Continuation token from a previous screenshots response
 *     responses:
 *       200:
 *         description: Page of screenshots for the user
 */
router.get("/screenshots", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const schema = Joi.object({
        titleId: Joi.string().optional(),
        max: Joi.number().integer().min(1).max(100).default(24),
        since: Joi.date().iso().optional(),
        continuationToken: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.query);
    if (error) throw badRequest(error.message);
    const data = await getScreenshots(xuid, xboxliveToken, value);
    res.json(data);
}));

export default router;
