import crypto from "node:crypto";
import {env} from "../config/env.js";
import {badRequest, internal} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);

const LEGACY_DEVICE_CODE_URL = "https://login.live.com/oauth20_connect.srf";
const LEGACY_TOKEN_URL = "https://login.live.com/oauth20_token.srf";
const LEGACY_SCOPE = "service::user.auth.xboxlive.com::MBI_SSL";
const MODERN_DEVICE_CODE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MODERN_AUTHORIZE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MODERN_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MODERN_SCOPE = "XboxLive.signin XboxLive.offline_access";
const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const GUID_CLIENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isModernMicrosoftClientId(clientId) {
    return GUID_CLIENT_ID.test(String(clientId || ""));
}

export function getMicrosoftOAuthConfig(clientId, authMode = env.MICROSOFT_AUTH_MODE || "auto") {
    const type = authMode === "auto"
        ? isModernMicrosoftClientId(clientId) ? "modern" : "legacy"
        : authMode;
    if (type === "modern") {
        return {
            type: "modern",
            deviceCodeUrl: MODERN_DEVICE_CODE_URL,
            authorizeUrl: MODERN_AUTHORIZE_URL,
            tokenUrl: MODERN_TOKEN_URL,
            scope: MODERN_SCOPE
        };
    }
    return {
        type: "legacy",
        deviceCodeUrl: LEGACY_DEVICE_CODE_URL,
        authorizeUrl: null,
        tokenUrl: LEGACY_TOKEN_URL,
        scope: LEGACY_SCOPE
    };
}

export function buildDeviceCodeRequest(clientId) {
    const config = getMicrosoftOAuthConfig(clientId);
    const body = new URLSearchParams({client_id: clientId, scope: config.scope});
    if (config.type === "legacy") body.set("response_type", "device_code");
    return {url: config.deviceCodeUrl, body};
}

export function buildDeviceTokenRequest(clientId, deviceCode) {
    const config = getMicrosoftOAuthConfig(clientId);
    return {
        url: config.tokenUrl,
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: DEVICE_CODE_GRANT,
            device_code: deviceCode
        })
    };
}

export function buildRefreshTokenRequest(clientId, refreshToken) {
    const config = getMicrosoftOAuthConfig(clientId);
    return {
        url: config.tokenUrl,
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            scope: config.scope
        })
    };
}

export function createPkcePair() {
    const verifier = crypto.randomBytes(64).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    return {verifier, challenge};
}

export function buildBrowserAuthorizationUrl(clientId, redirectUri, state, codeChallenge) {
    const config = getMicrosoftOAuthConfig(clientId);
    if (!isModernMicrosoftClientId(clientId) || config.type !== "modern") {
        throw badRequest("Browser login requires a Microsoft Entra GUID client ID in modern auth mode");
    }
    const url = new URL(config.authorizeUrl);
    url.search = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        response_mode: "query",
        redirect_uri: redirectUri,
        scope: config.scope,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256"
    }).toString();
    return url.toString();
}

export function buildAuthorizationCodeTokenRequest(clientId, code, redirectUri, codeVerifier, clientSecret) {
    const config = getMicrosoftOAuthConfig(clientId);
    if (!isModernMicrosoftClientId(clientId) || config.type !== "modern") {
        throw badRequest("Browser login requires a Microsoft Entra GUID client ID in modern auth mode");
    }
    const body = new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope: config.scope,
        code_verifier: codeVerifier,
        client_secret: clientSecret
    });
    return {url: config.tokenUrl, body};
}

function formOptions() {
    return {headers: {"content-type": "application/x-www-form-urlencoded"}};
}

export async function requestDeviceCode(clientId, httpClient = http) {
    try {
        const request = buildDeviceCodeRequest(clientId);
        const {data} = await httpClient.post(request.url, request.body.toString(), formOptions());
        return data;
    } catch (err) {
        throw internal("Failed to request device code", err.response?.data || err.message);
    }
}

export async function getTokenFromDeviceCode(clientId, deviceCode, httpClient = http) {
    if (!deviceCode) throw badRequest("device_code is required");
    try {
        const request = buildDeviceTokenRequest(clientId, deviceCode);
        const {data} = await httpClient.post(request.url, request.body.toString(), formOptions());
        return data;
    } catch (err) {
        const payload = err.response?.data;
        if (payload?.error === "authorization_pending") {
            const e = badRequest("Authorization pending");
            e.details = payload.error_description;
            throw e;
        }
        throw internal("Failed to exchange device_code", payload || err.message);
    }
}

export async function refreshMsToken(clientId, refreshToken, httpClient = http) {
    if (!refreshToken) throw badRequest("refresh_token is required");
    try {
        const request = buildRefreshTokenRequest(clientId, refreshToken);
        const {data} = await httpClient.post(request.url, request.body.toString(), formOptions());
        return data;
    } catch (err) {
        throw internal("Failed to refresh ms token", err.response?.data || err.message);
    }
}

export async function exchangeAuthorizationCode({
    clientId,
    code,
    redirectUri,
    codeVerifier,
    clientSecret
}, httpClient = http) {
    if (!code) throw badRequest("Authorization code is required");
    if (!codeVerifier) throw badRequest("PKCE code_verifier is required");
    if (!clientSecret) throw badRequest("Microsoft OAuth client secret is not configured");
    try {
        const request = buildAuthorizationCodeTokenRequest(clientId, code, redirectUri, codeVerifier, clientSecret);
        const {data} = await httpClient.post(request.url, request.body.toString(), formOptions());
        return data;
    } catch {
        throw badRequest("Failed to exchange Microsoft authorization code");
    }
}
