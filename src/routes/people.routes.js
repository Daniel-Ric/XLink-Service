import express from "express";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getGamertagsBatch, getPeopleFollowers, getPeopleSocial, getPresenceBatch} from "../services/xbox.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: People
 *     description: Xbox friends, followers and mutuals based on PeopleHub social APIs.
 */

/**
 * @swagger
 * /people/friends:
 *   get:
 *     summary: List mutual friends (you follow them and they follow you)
 *     description: >
 *       Retrieves the caller's social graph and filters it down to mutual relationships:
 *       users that you follow **and** that follow you back. Internally uses PeopleHub
 *       social APIs and respects `maxItems`.
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
 *         description: Maximum number of people to scan before filtering to mutual friends (1–2000)
 *     responses:
 *       200:
 *         description: List of mutual friends
 */
router.get("/friends", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const maxItems = Math.max(1, Math.min(parseInt(req.query.maxItems || "200", 10), 2000));
    const locale = req.headers["accept-language"];
    const data = await getPeopleSocial(xuid, xboxliveToken, maxItems, locale);

    const list = (data?.people || data?.People || []);
    const people = list.filter(p => (p?.isFollowingCaller === true) && (p?.isFollowedByCaller === true));

    res.json({count: people.length, people});
}));

/**
 * @swagger
 * /people/followers:
 *   get:
 *     summary: List followers (they follow you)
 *     description: >
 *       Returns all users that follow the caller, regardless of whether you follow them back.
 *       This is a straight wrapper around the PeopleHub followers endpoint.
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
 *         description: Maximum number of followers to fetch (1–2000)
 *     responses:
 *       200:
 *         description: List of followers for the caller
 */
router.get("/followers", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const maxItems = Math.max(1, Math.min(parseInt(req.query.maxItems || "200", 10), 2000));
    const locale = req.headers["accept-language"];
    const data = await getPeopleFollowers(xuid, xboxliveToken, maxItems, locale);
    const people = (data?.people || data?.People || []);
    res.json({count: people.length, people});
}));

/**
 * @swagger
 * /people/friends/presence:
 *   get:
 *     summary: Presence for the first N mutual friends
 *     description: >
 *       Combines PeopleHub and presence APIs to return presence information for up to N mutual
 *       friends. Shell titles and generic "Online" entries are normalized into `isPseudoOnline`
 *       to make it easier to distinguish real game sessions from dashboard-only presence.
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
 *         description: Maximum number of mutual friends to include in the presence batch
 *     responses:
 *       200:
 *         description: Presence information for mutual friends
 */
const SHELL_TITLE_IDS = new Set([704208617, 1022622766, 1794566092]);

router.get("/friends/presence", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");

    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const locale = req.headers["accept-language"];

    const data = await getPeopleSocial(xuid, xboxliveToken, limit, locale);

    const friends = (data?.people || data?.People || [])
        .filter(p => p?.isFollowingCaller === true && p?.isFollowedByCaller === true)
        .slice(0, limit);

    const xuids = friends.map(f => f.xuid).filter(Boolean);

    const [presenceRaw, gtMap] = xuids.length ? await Promise.all([getPresenceBatch(xuids, xboxliveToken, {
        level: "all",
        locale
    }), getGamertagsBatch(xuids, xboxliveToken, locale)]) : [{people: []}, {}];

    const presenceArray = Array.isArray(presenceRaw) ? presenceRaw : Array.isArray(presenceRaw.people) ? presenceRaw.people : [];

    const presence = presenceArray.map(p => {
        const ls = p?.lastSeen || null;
        const titleIdNum = ls?.titleId != null ? Number(ls.titleId) : null;
        const titleName = (ls?.titleName || "").trim();

        const isPseudoOnline = !!ls && (titleName.toLowerCase() === "online" || (titleIdNum != null && SHELL_TITLE_IDS.has(titleIdNum)));

        return {
            ...p, gamertag: gtMap[p.xuid] ?? null, lastSeen: isPseudoOnline ? undefined : ls, isPseudoOnline
        };
    });

    res.json({friends: friends.length, xuids, presence});
}));

export default router;
