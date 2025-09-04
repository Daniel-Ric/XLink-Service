import express from "express";
import { jwtMiddleware } from "../utils/jwt.js";
import { asyncHandler } from "../utils/async.js";
import { getPeople, getPresenceBatch } from "../services/xbox.service.js";
import { badRequest } from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: People
 *     description: Friends / Followers (PeopleHub)
 */

/**
 * @swagger
 * /people/friends:
 *   get:
 *     summary: Liste gemeinsamer Freunde (mutual)
 *     tags: [People]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         schema: { type: string }
 *         required: true
 *       - in: query
 *         name: maxItems
 *         schema: { type: integer, default: 200 }
 *     responses:
 *       200:
 *         description: Friends
 */
router.get("/friends", jwtMiddleware, asyncHandler(async (req, res) => {
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const maxItems = Math.max(1, Math.min(parseInt(req.query.maxItems || "200", 10), 2000));
    const data = await getPeople(xboxliveToken, maxItems);

    const people = (data?.people || data?.People || []).filter(p =>
        (p?.isFollowingCaller === true) && (p?.isFollowedByCaller === true)
    );

    res.json({ count: people.length, people });
}));

/**
 * @swagger
 * /people/followers:
 *   get:
 *     summary: Follower (sie folgen dir)
 *     tags: [People]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: maxItems
 *         schema: { type: integer, default: 200 }
 *     responses:
 *       200:
 *         description: Followers
 */
router.get("/followers", jwtMiddleware, asyncHandler(async (req, res) => {
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const maxItems = Math.max(1, Math.min(parseInt(req.query.maxItems || "200", 10), 2000));
    const data = await getPeople(xboxliveToken, maxItems);

    const people = (data?.people || data?.People || []).filter(p => (p?.isFollowingCaller === true));
    res.json({ count: people.length, people });
}));

/**
 * @swagger
 * /people/friends/presence:
 *   get:
 *     summary: Presence-Infos für (bis zu) die ersten N Freunde
 *     tags: [People]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
 *     responses:
 *       200:
 *         description: Presence-Daten
 */
router.get("/friends/presence", jwtMiddleware, asyncHandler(async (req, res) => {
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);

    const data = await getPeople(xboxliveToken, limit);
    const friends = (data?.people || data?.People || []).filter(p =>
        (p?.isFollowingCaller === true) && (p?.isFollowedByCaller === true)
    ).slice(0, limit);

    const xuids = friends.map(f => f.xuid).filter(Boolean);
    const presence = xuids.length ? await getPresenceBatch(xuids, xboxliveToken) : { people: [] };

    res.json({ friends: friends.length, xuids, presence });
}));

export default router;
