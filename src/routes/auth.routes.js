import express from "express";
import Joi from "joi";
import {asyncHandler} from "../utils/async.js";
import {jwtMiddleware, signJwt} from "../utils/jwt.js";
import {getTokenFromDeviceCode, refreshMsToken, requestDeviceCode} from "../services/microsoft.service.js";
import {getXBLToken, getXSTSToken} from "../services/xbox.service.js";
import {getEntityToken, loginWithXbox} from "../services/playfab.service.js";
import {getMCToken} from "../services/minecraft.service.js";
import {env} from "../config/env.js";
import {authLimiter} from "../middleware/rateLimit.js";
import {badRequest} from "../utils/httpError.js";
import {buildAuthCallbackResponse} from "../utils/authResponse.js";

const router = express.Router();

/**
 * @swagger
 * /auth/device:
 *   get:
 *     summary: Start Microsoft device-code sign-in
 *     description: >
 *       Starts the Microsoft device-code OAuth flow by requesting a `device_code` and `user_code`.
 *       Use the `verification_url` and `user_code` to sign in on another device, then poll
 *       `/auth/callback` with the `device_code` to obtain Xbox / PlayFab / Minecraft tokens.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Device code issued successfully
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
 *     summary: Exchange device_code for Xbox / PlayFab / Minecraft tokens
 *     description: >
 *       Completes the device-code flow. Exchanges the previously issued `device_code` for:
 *       - a signed JWT used to access this API
 *       - Xbox Live XSTS tokens
 *       - a PlayFab SessionTicket
 *       - a Minecraft multiplayer token (MCToken)
 *       and convenience headers like `xboxliveToken`, `playfabToken`, `redeemToken`.
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
 *                 description: Device code returned by /auth/device
 *     responses:
 *       200:
 *         description: Tokens successfully issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthCallbackResponse'
 *       400:
 *         description: Authorization pending or invalid device_code
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
    const entityData = await getEntityToken(SessionTicket);
    const masterEntityData = PlayFabId ? await getEntityToken(SessionTicket, {
        Type: "master_player_account", Id: PlayFabId
    }) : null;
    const jwtToken = signJwt({xuid: xid, gamertag: gtg});

    res.json(buildAuthCallbackResponse({
        jwtToken,
        xuid: xid,
        gamertag: gtg,
        uhs,
        msAccessToken,
        msRefreshToken,
        msExpiresIn,
        xblToken,
        xsts: {xbox: xboxTokenInfo, redeem: redeemTokenInfo, playfab: playfabTokenInfo},
        xboxliveToken,
        playfabToken,
        redeemToken,
        mcToken,
        sessionTicket: SessionTicket,
        playFabId: PlayFabId,
        entityToken: entityData.EntityToken,
        entityTokenExpiresOn: entityData.TokenExpiration,
        entityTokenMaster: masterEntityData?.EntityToken,
        entityTokenMasterExpiresOn: masterEntityData?.TokenExpiration
    }));
}));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh Xbox / PlayFab / Minecraft tokens using msRefreshToken
 *     description: >
 *       Uses a previously issued Microsoft OAuth refresh token (`msRefreshToken`) to obtain a new
 *       Microsoft access token and then re-derives Xbox Live, PlayFab and Minecraft tokens,
 *       similar to `/auth/callback` but without requiring the device-code flow again.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [msRefreshToken]
 *             properties:
 *               msRefreshToken:
 *                 type: string
 *                 description: Microsoft OAuth refresh_token from a previous /auth/callback
 *     responses:
 *       200:
 *         description: Tokens successfully refreshed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthCallbackResponse'
 *       400:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/refresh", authLimiter, asyncHandler(async (req, res) => {
    const schema = Joi.object({msRefreshToken: Joi.string().required()});
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const titleId = env.PLAYFAB_TITLE_ID || "20ca2";
    const tokenData = await refreshMsToken(env.CLIENT_ID, value.msRefreshToken);

    const msAccessToken = tokenData.access_token;
    const msRefreshToken = tokenData.refresh_token || value.msRefreshToken;
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
    const entityData = await getEntityToken(SessionTicket);
    const masterEntityData = PlayFabId ? await getEntityToken(SessionTicket, {
        Type: "master_player_account", Id: PlayFabId
    }) : null;
    const jwtToken = signJwt({xuid: xid, gamertag: gtg});

    res.json(buildAuthCallbackResponse({
        jwtToken,
        xuid: xid,
        gamertag: gtg,
        uhs,
        msAccessToken,
        msRefreshToken,
        msExpiresIn,
        xblToken,
        xsts: {xbox: xboxTokenInfo, redeem: redeemTokenInfo, playfab: playfabTokenInfo},
        xboxliveToken,
        playfabToken,
        redeemToken,
        mcToken,
        sessionTicket: SessionTicket,
        playFabId: PlayFabId,
        entityToken: entityData.EntityToken,
        entityTokenExpiresOn: entityData.TokenExpiration,
        entityTokenMaster: masterEntityData?.EntityToken,
        entityTokenMasterExpiresOn: masterEntityData?.TokenExpiration
    }));
}));

/**
 * @swagger
 * /auth/whoami:
 *   get:
 *     summary: Get decoded JWT user payload
 *     description: >
 *       Returns the decoded payload of the current Bearer JWT, typically including the
 *       Xbox user ID (`xuid`) and gamertag. Useful to verify which account the backend
 *       considers as authenticated.
 *     tags: [Auth]
 *     security: [{BearerAuth: []}]
 *     responses:
 *       200:
 *         description: Decoded JWT payload for the current user
 */
router.get("/whoami", jwtMiddleware, asyncHandler(async (req, res) => {
    res.json({user: req.user});
}));

/**
 * @swagger
 * /auth/jwt/refresh:
 *   post:
 *     summary: Refresh API JWT while the current token is still valid
 *     description: >
 *       Issues a new short-lived API JWT for the same Xbox user as the current token.
 *       This endpoint can only be called while the existing JWT is still valid.
 *     tags: [Auth]
 *     security: [{BearerAuth: []}]
 *     responses:
 *       200:
 *         description: New JWT issued successfully
 */
router.post("/jwt/refresh", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid, gamertag} = req.user;
    const jwt = signJwt({xuid, gamertag});
    res.json({jwt, expiresIn: env.JWT_EXPIRES_IN || "1h"});
}));

export default router;
