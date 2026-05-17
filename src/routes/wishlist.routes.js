import express from "express";
import Joi from "joi";

import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";
import {getMCWishlistPage, updateMCWishlist} from "../services/minecraft.service.js";

const router = express.Router();

const versionCache = new Map();

/**
 * @swagger
 * tags:
 *   - name: Wishlist
 *     description: Minecraft Marketplace wishlist via store.mktpl.minecraft-services.net
 */

function getCachedVersions(mcToken) {
    const v = versionCache.get(mcToken);
    if (!v) return null;
    return {
        listVersion: v.listVersion,
        inventoryVersion: v.inventoryVersion
    };
}

function setCachedVersions(mcToken, listVersion, inventoryVersion) {
    const current = versionCache.get(mcToken) || {};
    versionCache.set(mcToken, {
        listVersion: listVersion || current.listVersion,
        inventoryVersion: inventoryVersion || current.inventoryVersion
    });
}

function clearCachedVersions(mcToken) {
    versionCache.delete(mcToken);
}

function stringifyDetails(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function isMarketplaceVersionError(err) {
    if (![400, 409].includes(err?.status)) return false;
    const text = `${err.message || ""} ${stringifyDetails(err.details)}`.toLowerCase();
    return text.includes("version") || text.includes("etag") || text.includes("userlist") || text.includes("inventory");
}

async function resolveVersions(mcToken, options = {}) {
    if (options.refresh) clearCachedVersions(mcToken);

    const cached = getCachedVersions(mcToken);
    if (cached?.listVersion && cached?.inventoryVersion) return cached;

    const pre = await getMCWishlistPage(mcToken, {
        entitlements: []
    });

    const listVersion = pre?.meta?.userListsVersion || pre?.data?.result?.userListsVersion;
    const inventoryVersion = pre?.meta?.inventoryVersion || pre?.data?.result?.inventoryVersion;

    if (!listVersion || !inventoryVersion) throw badRequest("Failed to resolve listVersion/inventoryVersion");

    setCachedVersions(mcToken, listVersion, inventoryVersion);

    return {listVersion, inventoryVersion};
}

/**
 * @swagger
 * /wishlist/list:
 *   post:
 *     summary: Get wishlist (Marketplace PagedList_Wishlist)
 *     description: |
 *       Returns the current Minecraft Marketplace wishlist by proxying the official endpoint
 *       `POST /api/v2.0/layout/pages/PagedList_Wishlist`.
 *
 *       **What you must provide**
 *       - Header `x-mc-token`: the full Marketplace authorization header (starts with `MCToken ...`)
 *
 *       **What you can provide (optional)**
 *       - `recentlyViewed`: list of page ids (only needed if your client tracks it)
 *
 *       **Automatic behavior**
 *       - The server automatically handles internal Marketplace versioning (`InventoryETag` / `X-UserLists-Version`).
 *       - You do not need to send version fields.
 *
 *       **Response headers**
 *       - `InventoryETag`: current inventory version
 *       - `X-UserLists-Version`: current wishlist list version
 *     tags: [Wishlist]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Marketplace authorization header (must be the full value, e.g. `MCToken eyJ...`)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recentlyViewed:
 *                 type: array
 *                 description: Optional. List of recently viewed page ids used by the Marketplace layout service
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Marketplace wishlist page JSON (raw)
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/list", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");

    const schema = Joi.object({
        recentlyViewed: Joi.array().items(Joi.string()).optional()
    }).unknown(true);

    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    const cached = getCachedVersions(mcToken);

    const payload = {
        entitlements: []
    };
    if (Array.isArray(value.recentlyViewed)) payload.recentlyViewed = value.recentlyViewed;

    if (cached?.inventoryVersion) payload.inventoryVersion = cached.inventoryVersion;
    if (cached?.listVersion) payload.listVersion = cached.listVersion;

    let result;
    try {
        result = await getMCWishlistPage(mcToken, payload);
    } catch (err) {
        if (!cached || !isMarketplaceVersionError(err)) throw err;
        clearCachedVersions(mcToken);
        const retryPayload = {entitlements: []};
        if (Array.isArray(value.recentlyViewed)) retryPayload.recentlyViewed = value.recentlyViewed;
        result = await getMCWishlistPage(mcToken, retryPayload);
    }

    if (result?.meta?.inventoryVersion) res.setHeader("InventoryETag", result.meta.inventoryVersion);
    if (result?.meta?.userListsVersion) res.setHeader("X-UserLists-Version", result.meta.userListsVersion);

    setCachedVersions(mcToken, result?.meta?.userListsVersion, result?.meta?.inventoryVersion);

    res.json(result.data);
}));

/**
 * @swagger
 * /wishlist/item:
 *   post:
 *     summary: Add or remove wishlist item (Marketplace list_wishlist)
 *     description: |
 *       Adds or removes a Marketplace item from the Minecraft Marketplace wishlist by proxying the official endpoint
 *       `POST /api/v1.0/player/list_wishlist`.
 *
 *       **Operations**
 *       - `Add`    → adds `itemId` to the wishlist
 *       - `Remove` → removes `itemId` from the wishlist
 *
 *       **What you must provide**
 *       - Header `x-mc-token`: the full Marketplace authorization header (starts with `MCToken ...`)
 *       - Body:
 *         - `itemId` (required): Marketplace item UUID
 *         - `operation` (required): `Add` or `Remove`
 *
 *       **Automatic behavior**
 *       - The server automatically resolves and maintains Marketplace versions (`InventoryETag` / `X-UserLists-Version`).
 *       - You do not need to send any version fields.
 *
 *       **Response headers**
 *       - `InventoryETag`: current inventory version
 *       - `X-UserLists-Version`: current wishlist list version
 *     tags: [Wishlist]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Marketplace authorization header (must be the full value, e.g. `MCToken eyJ...`)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemId
 *               - operation
 *             properties:
 *               itemId:
 *                 type: string
 *                 description: Marketplace item UUID (e.g. `9d622932-b054-4533-a70d-4fd10aad104c`)
 *               operation:
 *                 type: string
 *                 description: Operation to perform on the wishlist
 *                 enum: [Add, Remove]
 *     responses:
 *       200:
 *         description: Operation acknowledged. Latest versions are returned via response headers (`InventoryETag`, `X-UserLists-Version`) when available.
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/item", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");

    const schema = Joi.object({
        itemId: Joi.string().required(),
        operation: Joi.string().valid("Add", "Remove").required()
    }).unknown(true);

    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    let versions = await resolveVersions(mcToken);

    let result;
    try {
        result = await updateMCWishlist(mcToken, {
            itemId: value.itemId,
            operation: value.operation,
            listVersion: versions.listVersion,
            inventoryVersion: versions.inventoryVersion
        });
    } catch (err) {
        if (!isMarketplaceVersionError(err)) throw err;
        versions = await resolveVersions(mcToken, {refresh: true});
        result = await updateMCWishlist(mcToken, {
            itemId: value.itemId,
            operation: value.operation,
            listVersion: versions.listVersion,
            inventoryVersion: versions.inventoryVersion
        });
    }

    if (result?.inventoryVersion) res.setHeader("InventoryETag", result.inventoryVersion);
    if (result?.userListsVersion) res.setHeader("X-UserLists-Version", result.userListsVersion);

    setCachedVersions(mcToken, result?.userListsVersion, result?.inventoryVersion);

    res.json(result);
}));

export default router;
