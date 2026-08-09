import express from "express";
import Joi from "joi";
import {asyncHandler} from "../utils/async.js";
import {jwtMiddleware, signJwt, verifyJwt} from "../utils/jwt.js";
import {
    buildBrowserAuthorizationUrl,
    exchangeAuthorizationCode,
    getMicrosoftOAuthConfig,
    getTokenFromDeviceCode,
    isModernMicrosoftClientId,
    refreshMsToken,
    requestDeviceCode
} from "../services/microsoft.service.js";
import {env} from "../config/env.js";
import {authLimiter} from "../middleware/rateLimit.js";
import {badRequest, unauthorized} from "../utils/httpError.js";
import {exchangeMicrosoftTokenBundle} from "../services/auth.service.js";
import {
    buildFrontendPageUrl,
    buildFrontendResultUrl,
    consumeMicrosoftCallback,
    oauthSessionStore
} from "../services/oauthSession.service.js";

const router = express.Router();

router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    next();
});

function browserOAuthConfig() {
    if (!isModernMicrosoftClientId(env.CLIENT_ID) || getMicrosoftOAuthConfig(env.CLIENT_ID).type !== "modern") {
        throw badRequest("Browser login requires a Microsoft Entra GUID client ID in modern auth mode");
    }
    if (!env.MICROSOFT_OAUTH_REDIRECT_URI) {
        throw badRequest("Microsoft OAuth redirect URI is not configured");
    }
    if (!env.MICROSOFT_OAUTH_CLIENT_SECRET) {
        throw badRequest("Microsoft OAuth client secret is not configured");
    }
    return {
        clientId: env.CLIENT_ID,
        redirectUri: env.MICROSOFT_OAUTH_REDIRECT_URI,
        clientSecret: env.MICROSOFT_OAUTH_CLIENT_SECRET
    };
}

const browserSourceSchema = Joi.string().valid("direct", "website", "client");

function sendClientSuccess(res) {
    res.status(200).type("html").send("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Sign-in complete</title></head><body><main><h1>Sign-in complete</h1><p>You can close this tab and return to the application.</p></main></body></html>");
}

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

    const tokenData = await getTokenFromDeviceCode(env.CLIENT_ID, value.device_code);
    res.json(await exchangeMicrosoftTokenBundle(
        tokenData,
        env.CLIENT_ID,
        env.PLAYFAB_TITLE_ID || "20ca2"
    ));
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

    const tokenData = await refreshMsToken(env.CLIENT_ID, value.msRefreshToken);
    tokenData.refresh_token = tokenData.refresh_token || value.msRefreshToken;
    res.json(await exchangeMicrosoftTokenBundle(
        tokenData,
        env.CLIENT_ID,
        env.PLAYFAB_TITLE_ID || "20ca2"
    ));
}));

router.post("/browser/session", authLimiter, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        successPath: Joi.string().pattern(/^\/(?!\/)/).max(512)
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    browserOAuthConfig();
    const bearer = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    const authenticatedUser = bearer ? verifyJwt(bearer) : null;
    if (req.headers.authorization && !authenticatedUser) throw unauthorized("Invalid or expired JWT");
    res.status(201).json(oauthSessionStore.createHandoff("client", {
        successPath: value.successPath,
        expectedXuid: authenticatedUser?.xuid || null
    }));
}));

router.get("/browser", authLimiter, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        source: browserSourceSchema.default("direct"),
        session: Joi.string().when("source", {is: "client", then: Joi.required(), otherwise: Joi.forbidden()})
    });
    const {value, error} = schema.validate(req.query);
    if (error) throw badRequest(error.message);
    const config = browserOAuthConfig();
    if (value.source === "website" && !env.MICROSOFT_OAUTH_FRONTEND_REDIRECT_URI) {
        throw badRequest("Website OAuth redirect URI is not configured");
    }
    if (value.source === "client") {
        oauthSessionStore.getHandoff(value.session, "client");
    }
    const {state, codeChallenge} = oauthSessionStore.createAuthorization({
        source: value.source,
        handoffSessionId: value.session
    });
    const authorizationUrl = buildBrowserAuthorizationUrl(
        config.clientId,
        config.redirectUri,
        state,
        codeChallenge
    );
    res.redirect(302, authorizationUrl);
}));

router.get("/browser/callback", authLimiter, asyncHandler(async (req, res) => {
    const config = browserOAuthConfig();
    const {code, codeVerifier, context} = consumeMicrosoftCallback(req.query, oauthSessionStore);
    const tokenData = await exchangeAuthorizationCode({
        clientId: config.clientId,
        code,
        redirectUri: config.redirectUri,
        codeVerifier,
        clientSecret: config.clientSecret
    });
    const result = await exchangeMicrosoftTokenBundle(
        tokenData,
        config.clientId,
        env.PLAYFAB_TITLE_ID || "20ca2"
    );
    if (context.source === "client") {
        const handoff = oauthSessionStore.completeHandoff(context.handoffSessionId, result);
        if (handoff.successPath && env.MICROSOFT_OAUTH_FRONTEND_REDIRECT_URI) {
            return res.redirect(303, buildFrontendPageUrl(
                env.MICROSOFT_OAUTH_FRONTEND_REDIRECT_URI,
                handoff.successPath
            ));
        }
        return sendClientSuccess(res);
    }
    if (context.source === "website") {
        const resultCode = oauthSessionStore.createResult(result, "website");
        return res.redirect(303, buildFrontendResultUrl(env.MICROSOFT_OAUTH_FRONTEND_REDIRECT_URI, resultCode));
    }
    if (!env.MICROSOFT_OAUTH_FRONTEND_REDIRECT_URI) {
        return res.json(result);
    }
    const resultCode = oauthSessionStore.createResult(result, "direct");
    res.redirect(303, buildFrontendResultUrl(env.MICROSOFT_OAUTH_FRONTEND_REDIRECT_URI, resultCode));
}));

router.post("/browser/token", authLimiter, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        code: Joi.string().required(),
        source: browserSourceSchema.default("direct")
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    res.json(oauthSessionStore.consumeResult(value.code, value.source));
}));

router.post("/browser/session/token", authLimiter, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sessionId: Joi.string().required(),
        pollToken: Joi.string().required()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const result = oauthSessionStore.consumeHandoff(value.sessionId, value.pollToken, "client");
    if (result.status === "pending") return res.status(202).json(result);
    res.json(result.data);
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
    const {xuid, gamertag, uhs, tokenBindings} = req.user;
    const jwt = signJwt({xuid, gamertag, uhs, tokenBindings});
    res.json({jwt, expiresIn: env.JWT_EXPIRES_IN || "1h"});
}));

export default router;
