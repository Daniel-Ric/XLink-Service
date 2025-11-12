import express from "express";
import Joi from "joi";
import {asyncHandler} from "../utils/async.js";
import {jwtMiddleware, signJwt} from "../utils/jwt.js";
import {getTokenFromDeviceCode, requestDeviceCode} from "../services/microsoft.service.js";
import {getXBLToken, getXSTSToken} from "../services/xbox.service.js";
import {loginWithXbox} from "../services/playfab.service.js";
import {getMCToken} from "../services/minecraft.service.js";
import {env} from "../config/env.js";
import {authLimiter} from "../middleware/rateLimit.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * /auth/device:
 *   get:
 *     summary: Device Code für Microsoft Login anfordern
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Device Code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthDeviceResponse'
 */
router.get("/device", authLimiter, asyncHandler(async (_req, res) => {
    const deviceData = await requestDeviceCode(env.CLIENT_ID);
    res.json(deviceData);
}));

/**
 * @swagger
 * /auth/callback:
 *   post:
 *     summary: Auth mit device_code abschließen und Tokens liefern
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [device_code]
 *             properties:
 *               device_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Erfolgreich
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthCallbackResponse'
 *       400:
 *         description: Authorization pending / Bad Request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/callback", authLimiter, asyncHandler(async (req, res) => {
    const schema = Joi.object({device_code: Joi.string().required()});
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const titleId = env.PLAYFAB_TITLE_ID || "20ca2";
    const tokenData = await getTokenFromDeviceCode(env.CLIENT_ID, value.device_code);

    const msAccessToken = tokenData.access_token;
    const msRefreshToken = tokenData.refresh_token;
    const msExpiresIn = tokenData.expires_in;

    const xblToken = await getXBLToken(msAccessToken);

    const xboxTokenInfo = await getXSTSToken(xblToken, "http://xboxlive.com");
    const redeemTokenInfo = await getXSTSToken(xblToken, "https://b980a380.minecraft.playfabapi.com/");
    const playfabTokenInfo = await getXSTSToken(xblToken, "rp://playfabapi.com/");

    const xboxUserInfo = xboxTokenInfo.DisplayClaims?.xui?.[0] || {};
    const {xid, uhs, gtg} = xboxUserInfo;

    const xboxliveToken = `XBL3.0 x=${uhs};${xboxTokenInfo.Token}`;
    const redeemToken = `XBL3.0 x=${uhs};${redeemTokenInfo.Token}`;
    const playfabToken = `XBL3.0 x=${uhs};${playfabTokenInfo.Token}`;

    const {SessionTicket, PlayFabId} = await loginWithXbox(playfabToken, titleId);
    const mcToken = await getMCToken(SessionTicket);
    const jwtToken = signJwt({xuid: xid, gamertag: gtg});

    res.json({
        jwt: jwtToken, xuid: xid, gamertag: gtg, uhs, msAccessToken, msRefreshToken, msExpiresIn, xblToken, xsts: {
            xbox: xboxTokenInfo, redeem: redeemTokenInfo, playfab: playfabTokenInfo
        }, xboxliveToken, playfabToken, redeemToken, mcToken, sessionTicket: SessionTicket, playFabId: PlayFabId
    });
}));

/**
 * @swagger
 * /auth/whoami:
 *   get:
 *     summary: Dekodierte JWT-User-Info
 *     tags: [Auth]
 *     security: [{BearerAuth: []}]
 *     responses:
 *       200:
 *         description: User
 */
router.get("/whoami", jwtMiddleware, asyncHandler(async (req, res) => {
    res.json({user: req.user});
}));

/**
 * @swagger
 * /auth/jwt/refresh:
 *   post:
 *     summary: JWT Refresh (sofern aktueller JWT noch gültig)
 *     tags: [Auth]
 *     security: [{BearerAuth: []}]
 *     responses:
 *       200:
 *         description: Neuer JWT
 */
router.post("/jwt/refresh", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid, gamertag} = req.user;
    const jwt = signJwt({xuid, gamertag});
    res.json({jwt, expiresIn: "1h"});
}));

export default router;
