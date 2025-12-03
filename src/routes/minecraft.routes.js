import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getMCToken} from "../services/minecraft.service.js";
import {loginWithXbox} from "../services/playfab.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

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
 *       This is useful when the previous SessionTicket has expired but the Xbox / PlayFab
 *       login is still valid.
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
 *         description: New PlayFab SessionTicket and Minecraft multiplayer token
 */
router.post("/token/refresh", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        playfabToken: Joi.string().required()
    });

    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const {SessionTicket, PlayFabId} = await loginWithXbox(value.playfabToken);
    const mcToken = await getMCToken(SessionTicket);

    res.json({
        sessionTicket: SessionTicket, playFabId: PlayFabId, mcToken
    });
}));

export default router;