import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getPresence, getPresenceBatch, removePresenceTitle, updatePresenceTitle} from "../services/xbox.service.js";
import {badRequest} from "../utils/httpError.js";
import {readXsapiContext} from "../utils/xsapiContext.js";

const router = express.Router();

function requireXblToken(req) {
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    return xboxliveToken;
}

/**
 * @swagger
 * /presence/me:
 *   get:
 *     summary: Get presence for the authenticated user
 *     description: >
 *       Returns the raw Xbox presence document for the current user, including device sessions,
 *       titles and last seen information. Requires an Xbox Live XSTS token.
 *     tags: [Presence]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Presence document for the current user
 */
router.get("/me", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = requireXblToken(req);
    const presence = await getPresence(xuid, xboxliveToken);
    res.json(presence);
}));

router.get("/xuid/:xuid", jwtMiddleware, asyncHandler(async (req, res) => {
    const presence = await getPresence(req.params.xuid, requireXblToken(req));
    res.json(presence);
}));

router.post("/title", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        id: Joi.number().integer().min(1).optional(),
        state: Joi.string().valid("active", "inactive", "Active", "Inactive").default("active"),
        placement: Joi.string().valid("full", "snapped", "fill", "background").optional(),
        activity: Joi.object({
            richPresence: Joi.object({
                id: Joi.string().required(),
                scid: Joi.string().guid().required(),
                params: Joi.array().items(Joi.string()).optional()
            }).optional(),
            media: Joi.object({
                id: Joi.string().required(),
                idType: Joi.string().required()
            }).optional()
        }).optional(),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional()
    }).unknown(false);
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const {proofKeyJwk, deviceToken, titleToken, userToken, authorizationToken, xstsTokens} = value;
    const body = {...value};
    delete body.proofKeyJwk;
    delete body.deviceToken;
    delete body.titleToken;
    delete body.userToken;
    delete body.authorizationToken;
    delete body.xstsTokens;

    const result = await updatePresenceTitle(req.user.xuid, requireXblToken(req), body, {
        ...readXsapiContext(req),
        proofKeyJwk,
        deviceToken,
        titleToken,
        userToken,
        authorizationToken,
        xstsTokens
    });
    res.json(result);
}));

router.delete("/title", jwtMiddleware, asyncHandler(async (req, res) => {
    const result = await removePresenceTitle(req.user.xuid, requireXblToken(req), readXsapiContext(req));
    res.json(result);
}));

/**
 * @swagger
 * /presence/batch:
 *   post:
 *     summary: Get presence for multiple XUIDs
 *     description: >
 *       Batch endpoint for fetching presence information for multiple users at once.
 *       The Xbox Live service may limit the number of XUIDs per request; this API forwards
 *       your list and returns the raw presence batch response.
 *     tags: [Presence]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [xuids]
 *             properties:
 *               xuids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of XUIDs to query
 *     responses:
 *       200:
 *         description: Presence information for the requested users
 */
router.post("/batch", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        xuids: Joi.array().items(Joi.string().pattern(/^\d+$/).max(20)).min(1).max(1100).unique().required(),
        level: Joi.string().valid("user", "device", "title", "all").default("all"),
        onlineOnly: Joi.boolean().default(false),
        locale: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const data = await getPresenceBatch(value.xuids, requireXblToken(req), {
        level: value.level,
        onlineOnly: value.onlineOnly,
        locale: value.locale || req.headers["accept-language"]
    });
    res.json(data);
}));

export default router;
