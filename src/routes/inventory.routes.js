import express from "express";
import Joi from "joi";
import jwtLib from "jsonwebtoken";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getEntityToken, getPlayFabInventory, loginWithXbox} from "../services/playfab.service.js";
import {getMCBalances, getMCInventory} from "../services/minecraft.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();
const PLAYFAB_TEST_TITLE_ID = "e9d1";

/**
 * @swagger
 * /inventory/playfab:
 *   post:
 *     summary: Get PlayFab inventory using a SessionTicket
 *     description: >
 *       Calls PlayFab's Inventory/GetInventoryItems for the specified entity. If `playFabId`
 *       is provided, the entity will be the `master_player_account`; otherwise the session's
 *       default entity is used. Returns the entity descriptor and its inventory items.
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
 *               sessionTicket:
 *                 type: string
 *                 description: PlayFab SessionTicket (X-Authorization)
 *               playFabId:
 *                 type: string
 *                 description: Optional PlayFabId to target master_player_account instead of the default entity
 *               collectionId:
 *                 type: string
 *                 default: "default"
 *               count:
 *                 type: integer
 *                 default: 50
 *                 minimum: 1
 *                 maximum: 200
 *     responses:
 *       200:
 *         description: PlayFab inventory items for the chosen entity
 */
router.post("/playfab", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sessionTicket: Joi.string().required(),
        playFabId: Joi.string().optional(),
        collectionId: Joi.string().default("default"),
        count: Joi.number().integer().min(1).max(200).default(50)
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const entityData = value.playFabId ? await getEntityToken(value.sessionTicket, {
        Type: "master_player_account", Id: value.playFabId
    }) : await getEntityToken(value.sessionTicket);

    const inv = await getPlayFabInventory(entityData.EntityToken, entityData.Entity.Id, entityData.Entity.Type, value.collectionId, value.count);

    res.json({entity: entityData.Entity, items: inv.Items || []});
}));

/**
 * @swagger
 * /inventory/playfab/test:
 *   post:
 *     summary: Test PlayFab inventory for title id e9d1
 *     description: >
 *       Logs in with a PlayFab XSTS token, exchanges for an EntityToken, and returns inventory
 *       items for the selected entity type using title id e9d1.
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [playfabToken]
 *             properties:
 *               playfabToken:
 *                 type: string
 *                 description: PlayFab XSTS token in the form XBL3.0 x={uhs};{token}
 *               entityType:
 *                 type: string
 *                 enum: [title_player_account, master_player_account]
 *                 default: title_player_account
 *               entityId:
 *                 type: string
 *                 description: Optional entity id override for the chosen entity type
 *               collectionId:
 *                 type: string
 *                 default: "default"
 *               count:
 *                 type: integer
 *                 default: 50
 *                 minimum: 1
 *                 maximum: 200
 *     responses:
 *       200:
 *         description: PlayFab inventory items for the chosen entity
 */
router.post("/playfab/test", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        playfabToken: Joi.string().required(),
        entityType: Joi.string().valid("title_player_account", "master_player_account").default("title_player_account"),
        entityId: Joi.string().optional(),
        collectionId: Joi.string().default("default"),
        count: Joi.number().integer().min(1).max(200).default(50)
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const loginData = await loginWithXbox(value.playfabToken, PLAYFAB_TEST_TITLE_ID);
    const sessionTicket = loginData.SessionTicket;
    const playFabId = loginData.PlayFabId;
    if (value.entityType === "master_player_account" && !value.entityId && !playFabId) {
        throw badRequest("PlayFabId is required for master_player_account");
    }

    const entityOverride = value.entityId ? {
        Type: value.entityType, Id: value.entityId
    } : value.entityType === "master_player_account" ? {
        Type: value.entityType, Id: playFabId
    } : null;

    const entityData = await getEntityToken(sessionTicket, entityOverride || undefined, PLAYFAB_TEST_TITLE_ID);
    const inv = await getPlayFabInventory(entityData.EntityToken, entityData.Entity.Id, entityData.Entity.Type, value.collectionId, value.count, PLAYFAB_TEST_TITLE_ID);

    res.json({entity: entityData.Entity, items: inv.Items || []});
}));

/**
 * @swagger
 * /inventory/minecraft:
 *   get:
 *     summary: List Minecraft Marketplace entitlements
 *     description: >
 *       Returns Minecraft Marketplace entitlements for the calling account using an MCToken.
 *       You can optionally include the raw receipts for deeper analysis or PlayFab correlation.
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema: { type: string }
 *         description: Minecraft Authorization header (MCToken …) as obtained from /minecraft/token or /auth/callback
 *       - in: query
 *         name: includeReceipt
 *         schema: { type: boolean, default: false }
 *         description: Whether to include full receipts for each entitlement
 *     responses:
 *       200:
 *         description: List of Minecraft entitlements for the account
 */
router.get("/minecraft", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");
    const rawInclude = req.query.includeReceipt ?? req.query.IncludeReceipt ?? (req.body && (req.body.includeReceipt ?? req.body.IncludeReceipt));
    const includeReceipt = String(rawInclude ?? "false").toLowerCase() === "true";
    const entitlements = await getMCInventory(mcToken, includeReceipt);
    res.json({count: entitlements.length, entitlements});
}));

/**
 * @swagger
 * /inventory/minecraft/balances:
 *   get:
 *     summary: Get Minecraft virtual currency balances
 *     description: >
 *       Returns the current virtual currency balances from the Minecraft Marketplace
 *       entitlements service using an MCToken.
 *     tags: [Inventory]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema: { type: string }
 *         description: Minecraft Authorization header (MCToken …) as obtained from /minecraft/token or /auth/callback
 *     responses:
 *       200:
 *         description: Minecraft virtual currency balances
 */
router.get("/minecraft/balances", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");
    const balances = await getMCBalances(mcToken);
    res.json(balances);
}));

/**
 * @swagger
 * /inventory/minecraft/creators/top:
 *   get:
 *     summary: Compute top creators from Minecraft entitlements
 *     description: >
 *       Aggregates Minecraft Marketplace entitlements by creator and returns the creators
 *       with the highest number of owned items. This is useful for quick “favorite creator”
 *       statistics.
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
 *         description: Maximum number of creators to return
 *     responses:
 *       200:
 *         description: Top creators sorted by number of entitlements
 */
router.get("/minecraft/creators/top", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");
    const limit = Math.min(Math.max(parseInt(req.query.limit || "5", 10), 1), 50);
    const ents = await getMCInventory(mcToken, true);

    const counts = {};
    for (const e of (ents || [])) {
        const rawReceipt = e?.Receipt ?? e?.receipt ?? null;
        if (typeof rawReceipt !== "string" || !rawReceipt) continue;

        let decoded;
        try {
            decoded = jwtLib.decode(rawReceipt);
        } catch {
            continue;
        }

        const recEnts = decoded?.Receipt?.Entitlements;
        if (!Array.isArray(recEnts)) continue;

        for (const re of recEnts) {
            const cid = re?.CreatorId ?? re?.creatorId ?? null;
            if (!cid) continue;
            counts[cid] = (counts[cid] || 0) + 1;
        }
    }

    const top = Object.entries(counts)
        .map(([creatorId, count]) => ({creatorId, count}))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    res.json({totalCreators: Object.keys(counts).length, top});
}));

/**
 * @swagger
 * /inventory/minecraft/search:
 *   get:
 *     summary: Search Minecraft entitlements by productId or free-text
 *     description: >
 *       Performs a simple in-memory search across all Minecraft entitlements. You can
 *       filter by a concrete `productId` and/or perform a case-insensitive substring search
 *       (`q`) over the serialized entitlement object.
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
 *         description: Exact product or entitlement identifier to match
 *       - in: query
 *         name: q
 *         description: Case-insensitive free-text search across the JSON representation of each entitlement
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
 *         description: Maximum number of matching entitlements to return
 *     responses:
 *       200:
 *         description: Filtered entitlement list matching the query
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
        filtered = filtered.filter(e => e?.productId === productId || e?.id === productId || e?.skuId === productId || e?.entitlementId === productId);
    }
    if (q) {
        filtered = filtered.filter(e => JSON.stringify(e).toLowerCase().includes(q));
    }

    res.json({total: filtered.length, items: filtered.slice(0, limit)});
}));

export default router;
