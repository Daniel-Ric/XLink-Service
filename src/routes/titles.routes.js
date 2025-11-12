import express from "express";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getTitleHub} from "../services/xbox.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Titles
 *     description: Titel-Übersichten
 */

/**
 * @swagger
 * /titles/recent:
 *   get:
 *     summary: Kürzlich gespielte Titel (sortiert)
 *     tags: [Titles]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: Accept-Language
 *         required: false
 *         schema: { type: string, example: "en-US,en;q=0.9" }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Liste
 */
router.get("/recent", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");

    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const locale = req.headers["accept-language"];

    const titlesRaw = await getTitleHub(xuid, xboxliveToken, {
        maxItems: limit, fields: ["detail", "image", "scid", "achievement"], locale
    });
    const titles = (titlesRaw?.titles || []).slice();

    titles.sort((a, b) => {
        const ta = new Date(a?.titleHistory?.lastTimePlayed || 0).getTime();
        const tb = new Date(b?.titleHistory?.lastTimePlayed || 0).getTime();
        return tb - ta;
    });

    res.json({total: titles.length, items: titles.slice(0, limit)});
}));

export default router;
