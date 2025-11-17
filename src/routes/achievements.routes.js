import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getAchievements} from "../services/xbox.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * /achievements/me:
 *   get:
 *     summary: List achievements for the authenticated user
 *     description: >
 *       Returns the raw Xbox Live achievements response for the currently authenticated user.
 *       Optionally filter by a specific `titleId` to limit the result to a single game.
 *     tags: [Achievements]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Xbox Live XSTS token in the form `XBL3.0 x={uhs};{token}`
 *       - in: query
 *         name: titleId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional Xbox title ID to filter achievements to a single game
 *     responses:
 *       200:
 *         description: List of achievements for the user
 */
router.get("/me", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");

    const schema = Joi.object({titleId: Joi.string().optional()});
    const {value, error} = schema.validate(req.query);
    if (error) throw badRequest(error.message);

    const achievements = await getAchievements(xuid, xboxliveToken, {titleId: value.titleId});
    res.json(achievements);
}));

/**
 * @swagger
 * /achievements/summary:
 *   get:
 *     summary: Get earned vs total achievements for a title
 *     description: >
 *       Computes a simple summary for a given Xbox title: total number of achievements,
 *       number of unlocked achievements and the percentage completed. Internally this
 *       endpoint normalizes several different progress state shapes.
 *     tags: [Achievements]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: titleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Xbox title ID for which to compute the achievement summary
 *     responses:
 *       200:
 *         description: Aggregated achievement summary for the given title
 */
router.get("/summary", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");

    const schema = Joi.object({titleId: Joi.string().required()});
    const {value, error} = schema.validate(req.query);
    if (error) throw badRequest(error.message);

    const data = await getAchievements(xuid, xboxliveToken, {titleId: value.titleId});
    const list = Array.isArray(data.achievements) ? data.achievements : (data.achievements || data.titles || []);
    let total = 0, earned = 0;
    for (const a of list) {
        total++;
        const ps = (a.progressState || a.progressstate || a.progress || "").toString();
        const unlocked = a.unlocked === true || ps.toLowerCase() === "achieved" || ps.toLowerCase() === "completed";
        if (unlocked) earned++;
    }
    res.json({
        titleId: value.titleId, total, earned, percent: total ? Math.round((earned / total) * 100) : 0
    });
}));

export default router;
