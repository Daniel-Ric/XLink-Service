import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getProfileSettings, getTitleHub, getXboxStats} from "../services/xbox.service.js";
import {getEntityToken, getPlayFabInventory} from "../services/playfab.service.js";
import {getMCInventory, getMCToken} from "../services/minecraft.service.js";
import {badRequest} from "../utils/httpError.js";
import jwtLib from "jsonwebtoken";

const router = express.Router();

/**
 * @swagger
 * /profile/me:
 *   get:
 *     summary: Get basic Xbox profile settings for the current user
 *     description: >
 *       Reads selected profile settings for the authenticated user from Xbox Live,
 *       such as display picture URL, Gamerscore and Gamertag. The list of settings
 *       can be customized via the `settings` query parameter.
 *     tags: [Profile]
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
 *         name: settings
 *         schema:
 *           type: string
 *           default: GameDisplayPicRaw,Gamerscore,Gamertag
 *         description: Comma-separated list of profile setting IDs to request
 *     responses:
 *       200:
 *         description: Profile settings for the current user
 */
router.get("/me", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const settings = req.query.settings || "GameDisplayPicRaw,Gamerscore,Gamertag";
    const profile = await getProfileSettings(xuid, xboxliveToken, settings);
    res.json(profile);
}));

/**
 * @swagger
 * /profile/titles:
 *   get:
 *     summary: Get TitleHub entries for the current user
 *     description: >
 *       Uses the TitleHub service to fetch titles associated with the current user.
 *       This includes metadata such as title images, SCIDs and achievement info.
 *     tags: [Profile]
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
 *         description: Preferred language for localized title metadata
 *     responses:
 *       200:
 *         description: TitleHub response for the user
 */
router.get("/titles", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const locale = req.headers["accept-language"]; // wird in den Service durchgereicht
    const titles = await getTitleHub(xuid, xboxliveToken, {locale});
    res.json(titles);
}));

/**
 * @swagger
 * /profile/overview:
 *   post:
 *     summary: Combined overview (profile, Xbox stats and optional PlayFab & Minecraft inventory)
 *     description: >
 *       High-level “dashboard” endpoint that combines multiple services:
 *       - Xbox profile settings (Gamertag, Gamerscore, display picture)
 *       - Aggregated Xbox stats for several Minecraft SCIDs (minutes played, blocks broken, etc.)
 *       - Optional PlayFab inventory (if a SessionTicket is provided)
 *       - Optional Minecraft entitlements (using either `x-mc-token` or a Minecraft token created from SessionTicket)
 *
 *       This is intended for building rich player overview screens with a single call.
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: x-mc-token
 *         required: false
 *         schema: { type: string }
 *         description: Optional Minecraft token; if omitted and a SessionTicket is given, the service will try to obtain one
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileOverviewRequest'
 *     responses:
 *       200:
 *         description: Aggregated overview for the current user
 */
router.post("/overview", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid, gamertag} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");

    const bodySchema = Joi.object({
        sessionTicket: Joi.string().optional(),
        playFabId: Joi.string().optional(),
        includeReceipt: Joi.boolean().default(false)
    });
    const {value, error} = bodySchema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    const profile = await getProfileSettings(xuid, xboxliveToken, "GameDisplayPicRaw,Gamerscore,Gamertag");

    const statsRaw = await getXboxStats(xuid, xboxliveToken);
    const aggregated = {MinutesPlayed: 0, BlockBrokenTotal: 0, "MobKilled.IsMonster.1": 0, DistanceTravelled: 0};
    const user = statsRaw?.users?.[0];
    if (user?.scids) {
        for (const scid of user.scids) {
            for (const stat of (scid.stats || [])) {
                const v = parseFloat(stat.value);
                if (!Number.isNaN(v)) aggregated[stat.statname] = (aggregated[stat.statname] || 0) + v;
            }
        }
    }

    let playfab = null;
    let mcInventory = null;
    let mcToken = req.headers["x-mc-token"] || null;
    let topCreators = [];

    if (value.sessionTicket) {
        let entityData;
        if (value.playFabId) {
            entityData = await getEntityToken(value.sessionTicket, {
                Type: "master_player_account",
                Id: value.playFabId
            });
        } else {
            entityData = await getEntityToken(value.sessionTicket);
        }

        const pfInv = await getPlayFabInventory(entityData.EntityToken, entityData.Entity.Id, entityData.Entity.Type, "default", 50);
        const pfItems = pfInv.Items || [];
        playfab = {entity: entityData.Entity, itemsCount: pfItems.length, items: pfItems};

        const counts = {};
        for (const it of pfItems) {
            const rec = it.Receipt;
            if (typeof rec !== "string") continue;
            const decoded = jwtLib.decode(rec);
            const ents = decoded?.Receipt?.Entitlements;
            if (Array.isArray(ents)) {
                for (const e of ents) {
                    const cid = e.CreatorId;
                    if (!cid) continue;
                    counts[cid] = (counts[cid] || 0) + 1;
                }
            }
        }
        topCreators = Object.entries(counts)
            .map(([creatorId, count]) => ({creatorId, count}))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (!mcToken) {
            try {
                mcToken = await getMCToken(value.sessionTicket);
            } catch { /* ignore */
            }
        }
        if (mcToken) {
            try {
                mcInventory = await getMCInventory(mcToken, value.includeReceipt);
            } catch {
            }
        }
    }

    res.json({
        user: {xuid, gamertag},
        profile,
        stats: {aggregated, raw: statsRaw},
        playfab,
        minecraft: {mcToken: !!mcToken, entitlementsCount: mcInventory?.length || 0, entitlements: mcInventory || []},
        topCreators
    });
}));

export default router;
