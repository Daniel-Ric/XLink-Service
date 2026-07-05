import crypto from "node:crypto";
import {env} from "../config/env.js";
import {badRequest, forbidden, internal, unauthorized} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";
import {generateProofKey, normalizeProofKey, publicProofKey, signXboxRequest} from "./xsapiCrypto.service.js";
import {authSignaturePolicy, getDefaultTitleData, matchTitleData} from "./xsapiNsal.service.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);

const DEFAULT_XAL_USER_AGENT = "XAL Android 2025.04.20250326.000";
const DEFAULT_XAL_CLIENT_ID = "0000000048183522";
const DEFAULT_XAL_TITLE_ID = 1739947436;

function defaultConfig(options = {}) {
    return {
        clientId: options.clientId || env.XAL_CLIENT_ID || env.CLIENT_ID || DEFAULT_XAL_CLIENT_ID,
        titleId: Number(options.titleId || env.XAL_TITLE_ID || DEFAULT_XAL_TITLE_ID),
        sandbox: options.sandbox || env.XAL_SANDBOX || "RETAIL",
        userAgent: options.userAgent || env.XAL_USER_AGENT || DEFAULT_XAL_USER_AGENT,
        deviceType: options.deviceType || env.XAL_DEVICE_TYPE || "Android",
        deviceVersion: options.deviceVersion || env.XAL_DEVICE_VERSION || "13"
    };
}

function deviceId(deviceType, id = crypto.randomUUID()) {
    switch (deviceType) {
        case "Android":
        case "Nintendo":
            return {id: `{${id}}`};
        case "iOS":
            return {id: id.toUpperCase()};
        case "PlayStation":
            return {id};
        case "Win32":
        case "Xbox": {
            const wrapped = `{${id.toUpperCase()}}`;
            return {id: wrapped, serialNumber: wrapped};
        }
        default:
            throw badRequest(`Unknown XAL device type: ${deviceType}`);
    }
}

function tokenValid(token) {
    if (!token?.Token) return false;
    const notAfter = token.NotAfter ? Date.parse(token.NotAfter) : NaN;
    return Number.isNaN(notAfter) || notAfter > Date.now() + 30000;
}

function tokenValue(token) {
    if (typeof token === "string") return token;
    if (token?.Token) return token.Token;
    return null;
}

function xstsAuthHeader(token) {
    if (typeof token === "string" && token.startsWith("XBL3.0 ")) return token;
    const raw = tokenValue(token);
    const userInfo = token?.DisplayClaims?.xui?.[0] || {};
    if (!raw || !userInfo.uhs) throw badRequest("XSTS token response must include Token and DisplayClaims.xui[0].uhs");
    return `XBL3.0 x=${userInfo.uhs};${raw}`;
}

function tokenRequestBody({relyingParty, properties}) {
    return {
        RelyingParty: relyingParty,
        TokenType: "JWT",
        Properties: properties
    };
}

function httpError(err, message) {
    const status = err.response?.status;
    const detail = err.response?.data || err.message;
    if (status === 401) throw unauthorized(message, detail);
    if (status === 403) throw forbidden(message, detail);
    if (status && status >= 400 && status < 500) throw badRequest(message, detail);
    throw internal(message, detail);
}

async function signedPost(url, body, proofKeyJwk, {userAgent, headers = {}} = {}) {
    const payload = JSON.stringify(body);
    const requestHeaders = {
        "Content-Type": "application/json",
        "x-xbl-contract-version": "1",
        "User-Agent": userAgent || DEFAULT_XAL_USER_AGENT,
        ...headers
    };
    requestHeaders.Signature = signXboxRequest({
        method: "POST",
        url,
        headers: requestHeaders,
        authorization: requestHeaders.Authorization,
        body: payload,
        proofKeyJwk,
        policy: authSignaturePolicy()
    });
    const {data} = await http.post(url, payload, {headers: requestHeaders});
    return data;
}

export function createProofKey() {
    return generateProofKey();
}

export async function requestXasdDeviceToken(options = {}) {
    const config = defaultConfig(options);
    const proofKeyJwk = options.proofKeyJwk ? normalizeProofKey(options.proofKeyJwk) : generateProofKey().privateJwk;
    const device = deviceId(config.deviceType, options.deviceId);
    const body = tokenRequestBody({
        relyingParty: "http://auth.xboxlive.com",
        properties: {
            AuthMethod: "ProofOfPossession",
            Id: device.id,
            ...(device.serialNumber ? {SerialNumber: device.serialNumber} : {}),
            DeviceType: config.deviceType,
            Version: config.deviceVersion,
            ProofKey: publicProofKey(proofKeyJwk)
        }
    });

    try {
        const token = await signedPost("https://device.auth.xboxlive.com/device/authenticate", body, proofKeyJwk, {
            userAgent: config.userAgent
        });
        if (!tokenValid(token)) throw internal("Invalid XASD device token response");
        return {deviceToken: token, proofKeyJwk};
    } catch (err) {
        if (err.status) throw err;
        httpError(err, "Failed to request XASD device token");
    }
}

export async function authorizeXstsSigned({
    proofKeyJwk,
    relyingParty,
    deviceToken,
    titleToken,
    userToken,
    optionalDisplayClaims,
    ...options
} = {}) {
    if (!proofKeyJwk) throw badRequest("proofKeyJwk is required");
    if (!relyingParty) throw badRequest("relyingParty is required");
    const config = defaultConfig(options);
    const properties = {
        SandboxId: config.sandbox,
        ...(deviceToken ? {DeviceToken: tokenValue(deviceToken)} : {}),
        ...(titleToken ? {TitleToken: tokenValue(titleToken)} : {}),
        ...(userToken ? {UserTokens: [tokenValue(userToken)]} : {}),
        ...(optionalDisplayClaims?.length ? {OptionalDisplayClaims: optionalDisplayClaims} : {})
    };
    if (!properties.DeviceToken && !properties.TitleToken && !properties.UserTokens) {
        throw badRequest("At least one underlying token is required");
    }

    try {
        const token = await signedPost("https://xsts.auth.xboxlive.com/xsts/authorize", tokenRequestBody({
            relyingParty,
            properties
        }), normalizeProofKey(proofKeyJwk), {userAgent: config.userAgent});
        if (!tokenValid(token)) throw internal("Invalid XSTS token response");
        return token;
    } catch (err) {
        if (err.status) throw err;
        httpError(err, "Failed to request signed XSTS token");
    }
}

export async function authorizeSisuSession({
    msAccessToken,
    proofKeyJwk,
    deviceToken,
    xstsRelyingParties = [],
    ...options
} = {}) {
    if (!msAccessToken) throw badRequest("msAccessToken is required");
    const config = defaultConfig(options);
    const generated = !proofKeyJwk;
    const proof = proofKeyJwk ? normalizeProofKey(proofKeyJwk) : generateProofKey().privateJwk;
    let device = deviceToken;
    if (!device || !tokenValid(device)) {
        const result = await requestXasdDeviceToken({...config, proofKeyJwk: proof});
        device = result.deviceToken;
    }

    const body = {
        AccessToken: `t=${msAccessToken}`,
        AppId: config.clientId,
        DeviceToken: tokenValue(device),
        Sandbox: config.sandbox,
        UseModernGamertag: true,
        SiteName: "user.auth.xboxlive.com",
        RelyingParty: "http://xboxlive.com",
        ProofKey: publicProofKey(proof)
    };

    const payload = JSON.stringify(body);
    const url = "https://sisu.xboxlive.com/authorize";
    const headers = {
        "Content-Type": "application/json",
        "User-Agent": config.userAgent
    };
    const defaultTitleData = await getDefaultTitleData();
    const match = matchTitleData(defaultTitleData, url);
    headers.Signature = signXboxRequest({
        method: "POST",
        url,
        headers,
        body: payload,
        proofKeyJwk: proof,
        policy: match?.policy || authSignaturePolicy()
    });

    let session;
    try {
        const {data} = await http.post(url, payload, {headers});
        session = data;
    } catch (err) {
        httpError(err, "Failed to authorize SISU session");
    }

    const authorizationToken = session?.AuthorizationToken;
    const titleToken = session?.TitleToken;
    const userToken = session?.UserToken;
    if (!tokenValid(authorizationToken) || !tokenValid(titleToken) || !tokenValid(userToken)) {
        throw internal("Invalid SISU authorization response");
    }

    const xstsTokens = {"http://xboxlive.com": authorizationToken};
    for (const relyingParty of xstsRelyingParties || []) {
        if (!relyingParty || xstsTokens[relyingParty]) continue;
        xstsTokens[relyingParty] = await authorizeXstsSigned({
            proofKeyJwk: proof,
            relyingParty,
            deviceToken: device,
            titleToken,
            userToken,
            ...config
        });
    }

    const userInfo = authorizationToken.DisplayClaims?.xui?.[0] || {};
    return {
        proofKeyJwk: proof,
        proofKeyGenerated: generated,
        deviceToken: device,
        titleToken,
        userToken,
        authorizationToken,
        xstsTokens,
        xboxliveToken: xstsAuthHeader(authorizationToken),
        user: {
            xuid: userInfo.xid,
            gamertag: userInfo.gtg,
            modernGamertag: userInfo.mgt,
            modernGamertagSuffix: userInfo.mgs,
            uniqueModernGamertag: userInfo.umg,
            uhs: userInfo.uhs
        },
        config: {
            clientId: config.clientId,
            titleId: config.titleId,
            sandbox: config.sandbox,
            deviceType: config.deviceType,
            deviceVersion: config.deviceVersion,
            userAgent: config.userAgent
        }
    };
}

export function toXstsAuthorizationHeader(token) {
    return xstsAuthHeader(token);
}

export function isTokenValid(token) {
    return tokenValid(token);
}
