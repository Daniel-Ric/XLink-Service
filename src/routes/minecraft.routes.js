import express from "express";
import Joi from "joi";
import {jwtMiddleware, signJwt} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getMCToken} from "../services/minecraft.service.js";
import {loginWithXbox} from "../services/playfab.service.js";
import {badGateway, badRequest} from "../utils/httpError.js";
import {mergeTokenBindings} from "../utils/tokenBinding.js";
import {env} from "../config/env.js";

const router = express.Router();

function preventTokenCaching(res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
}

/**
 * @swagger
 * /minecraft/token:
 *   post:
 *     summary: Create a new Minecraft multiplayer token from a PlayFab SessionTicket
 *     description: >
 *       Exchanges a PlayFab SessionTicket for a Minecraft multiplayer authorization header
 *       (MCToken …). This token can be used against Minecraft services and for Marketplace
 *       inventory calls in other endpoints.
 *     tags: [Minecraft]
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
 *                 description: PlayFab SessionTicket obtained from the login flow
 *     responses:
 *       200:
 *         description: Minecraft multiplayer token successfully issued
 */
router.post("/token", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({sessionTicket: Joi.string().required()});
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const mcToken = await getMCToken(value.sessionTicket);
    preventTokenCaching(res);
    res.json({mcToken});
}));

/**
 * @swagger
 * /minecraft/token/refresh:
 *   post:
 *     summary: Refresh PlayFab SessionTicket and Minecraft token from PlayFab XSTS token
 *     description: >
 *       Uses an existing PlayFab XSTS token (playfabToken, XBL3.0 …) to obtain a fresh
 *       PlayFab SessionTicket and a new Minecraft multiplayer token (MCToken …).
 *       It also returns a replacement API JWT bound to the rotated SessionTicket. Clients
 *       must persist the JWT, SessionTicket and Minecraft token together.
 *     tags: [Minecraft]
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
 *                 description: >
 *                   PlayFab XSTS token in XBL3.0 format (`XBL3.0 x={uhs};{token}`) as
 *                   returned by /auth/callback.
 *     responses:
 *       200:
 *         description: New PlayFab SessionTicket, Minecraft token, and replacement API JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [jwt, expiresIn, sessionTicket, playFabId, mcToken]
 *               properties:
 *                 jwt:
 *                   type: string
 *                   description: Replacement API JWT bound to the returned SessionTicket and Minecraft token
 *                 expiresIn:
 *                   type: string
 *                 sessionTicket:
 *                   type: string
 *                 playFabId:
 *                   type: string
 *                 mcToken:
 *                   type: string
 *       502:
 *         description: PlayFab or Minecraft returned an invalid success response
 */
router.post("/token/refresh", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        playfabToken: Joi.string().required()
    });

    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const {SessionTicket, PlayFabId} = (await loginWithXbox(value.playfabToken)) || {};
    if (typeof SessionTicket !== "string" || !SessionTicket.trim()
        || typeof PlayFabId !== "string" || !PlayFabId.trim()) {
        throw badGateway("PlayFab returned an invalid login response");
    }
    const mcToken = await getMCToken(SessionTicket);
    if (typeof mcToken !== "string" || !mcToken.trim()) {
        throw badGateway("Minecraft returned an invalid token response");
    }
    const {xuid, gamertag, uhs} = req.user;
    const tokenBindings = mergeTokenBindings(req.user.tokenBindings, {
        sessionTicket: SessionTicket,
        minecraft: mcToken
    });
    const jwt = signJwt({xuid, gamertag, uhs, tokenBindings});

    preventTokenCaching(res);
    res.json({
        jwt,
        expiresIn: env.JWT_EXPIRES_IN || "1h",
        sessionTicket: SessionTicket,
        playFabId: PlayFabId,
        mcToken
    });
}));

export default router;
