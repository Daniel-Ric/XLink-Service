import express from "express";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getXboxStats} from "../services/xbox.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * /stats/xbox/me:
 *   get:
 *     summary: Xbox-Stats (Minecraft SCIDs) inkl. Aggregates
 *     tags: [Stats]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Stats + Aggregates
 */
router.get("/xbox/me", jwtMiddleware, asyncHandler(async (req, res) => {
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const {xuid} = req.user;
    const raw = await getXboxStats(xuid, xboxliveToken);
    const agg = {MinutesPlayed: 0, BlockBrokenTotal: 0, "MobKilled.IsMonster.1": 0, DistanceTravelled: 0};
    const user = raw?.users?.[0];
    if (user?.scids) {
        for (const scid of user.scids) {
            for (const stat of (scid.stats || [])) {
                const v = parseFloat(stat.value);
                if (!Number.isNaN(v)) agg[stat.statname] = (agg[stat.statname] || 0) + v;
            }
        }
    }
    res.json({aggregated: agg, raw});
}));

export default router;
