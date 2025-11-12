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
 *     summary: Achievements für aktuellen User
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
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Achievements
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
 *     summary: Zusammenfassung (earned/total) der Achievements für einen Titel
 *     tags: [Achievements]
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
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Summary
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
