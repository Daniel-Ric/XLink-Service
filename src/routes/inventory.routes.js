import express from "express";
import Joi from "joi";
import { jwtMiddleware } from "../utils/jwt.js";
import { asyncHandler } from "../utils/async.js";
import { getEntityToken, getPlayFabInventory } from "../services/playfab.service.js";
import { getMCInventory } from "../services/minecraft.service.js";
import { badRequest } from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * /inventory/playfab:
 *   post:
 *     summary: PlayFab-Inventar über SessionTicket abrufen
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionTicket]
 *             properties:
 *               sessionTicket: { type: string }
 *               playFabId:     { type: string, description: "Optional: Wenn gesetzt, wird master_player_account verwendet" }
 *               collectionId:  { type: string, default: "default" }
 *               count:         { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Items
 */
router.post("/playfab", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sessionTicket: Joi.string().required(),
        playFabId: Joi.string().optional(),
        collectionId: Joi.string().default("default"),
        count: Joi.number().integer().min(1).max(200).default(50)
    });
    const { value, error } = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    // EntityToken erzeugen – wenn PlayFabId vorhanden -> master_player_account, sonst Session-Entity.
    const entityData = value.playFabId
        ? await getEntityToken(value.sessionTicket, { Type: "master_player_account", Id: value.playFabId })
        : await getEntityToken(value.sessionTicket);

    const inv = await getPlayFabInventory(
        entityData.EntityToken,
        entityData.Entity.Id,
        entityData.Entity.Type,
        value.collectionId,
        value.count
    );

    res.json({ entity: entityData.Entity, items: inv.Items || [] });
}));

/**
 * @swagger
 * /inventory/minecraft:
 *   get:
 *     summary: Minecraft Marketplace-Entitlements (Inventory)
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includeReceipt
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Entitlements
 */
router.get("/minecraft", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");
    const includeReceipt = String(req.query.includeReceipt || "false") === "true";
    const entitlements = await getMCInventory(mcToken, includeReceipt);
    res.json({ count: entitlements.length, entitlements });
}));

/**
 * @swagger
 * /inventory/minecraft/creators/top:
 *   get:
 *     summary: Top-Creators aus MC-Entitlements (nach Anzahl Items)
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: Top-Creators
 */
router.get("/minecraft/creators/top", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");
    const limit = Math.min(Math.max(parseInt(req.query.limit || "5", 10), 1), 50);
    const ents = await getMCInventory(mcToken, false);

    const counts = {};
    for (const e of (ents || [])) {
        const cid =
            e?.creatorId ||
            e?.creator?.id ||
            e?.item?.creatorId ||
            e?.content?.creatorId ||
            e?.product?.creatorId ||
            e?.metadata?.creatorId ||
            null;
        if (!cid) continue;
        counts[cid] = (counts[cid] || 0) + 1;
    }

    const top = Object.entries(counts)
        .map(([creatorId, count]) => ({ creatorId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    res.json({ totalCreators: Object.keys(counts).length, top });
}));

/**
 * @swagger
 * /inventory/minecraft/search:
 *   get:
 *     summary: Einfache Suche in MC-Entitlements
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: productId
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         description: Textsuche (Case-Insensitive) innerhalb des Entitlement-Objekts
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
 *     responses:
 *       200:
 *         description: Trefferliste
 */
router.get("/minecraft/search", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");

    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const productId = (req.query.productId || "").trim();
    const q = (req.query.q || "").toLowerCase();

    const ents = await getMCInventory(mcToken, true);
    let filtered = ents;

    if (productId) {
        filtered = filtered.filter(e =>
            e?.productId === productId ||
            e?.id === productId ||
            e?.skuId === productId ||
            e?.entitlementId === productId
        );
    }
    if (q) {
        filtered = filtered.filter(e => JSON.stringify(e).toLowerCase().includes(q));
    }

    res.json({ total: filtered.length, items: filtered.slice(0, limit) });
}));

export default router;
