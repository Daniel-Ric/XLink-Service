import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";
import {authorizeSisuSession, authorizeXstsSigned, createProofKey, requestXasdDeviceToken} from "../services/xsapiAuth.service.js";
import {encodeProofKeyHeader, signXboxRequest} from "../services/xsapiCrypto.service.js";
import {resolveNsal} from "../services/xsapiNsal.service.js";
import {xsapiRequest} from "../services/xsapiHttp.service.js";
import {readXsapiContext} from "../utils/xsapiContext.js";

const router = express.Router();
const XSAPI_REQUEST_HOSTS = [
    /\.xboxlive\.com$/i,
    /\.playfabapi\.com$/i,
    /\.minecraft-services\.net$/i
];

function assertXsapiRequestUrl(value) {
    const url = new URL(value);
    const allowed = XSAPI_REQUEST_HOSTS.some(pattern => pattern.test(url.hostname));
    if (!allowed) throw badRequest("XSAPI request URL host is not allowed");
    return value;
}

router.post("/proof-key", jwtMiddleware, asyncHandler(async (_req, res) => {
    const key = createProofKey();
    res.json({
        proofKeyJwk: key.privateJwk,
        publicProofKeyJwk: key.publicJwk,
        proofKeyHeader: encodeProofKeyHeader(key.privateJwk),
        warning: "Treat proofKeyJwk like a secret. It can sign Xbox Live requests for this XAL device session."
    });
}));

router.post("/device-token", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        proofKeyJwk: Joi.object().optional(),
        deviceId: Joi.string().optional(),
        deviceType: Joi.string().optional(),
        deviceVersion: Joi.string().optional(),
        userAgent: Joi.string().optional(),
        clientId: Joi.string().optional(),
        titleId: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        sandbox: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const result = await requestXasdDeviceToken(value);
    res.json({
        ...result,
        proofKeyHeader: encodeProofKeyHeader(result.proofKeyJwk)
    });
}));

router.post("/session", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        msAccessToken: Joi.string().required(),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        xstsRelyingParties: Joi.array().items(Joi.string().uri({scheme: ["http", "https"]}).max(512)).max(16).unique().default([]),
        deviceType: Joi.string().optional(),
        deviceVersion: Joi.string().optional(),
        userAgent: Joi.string().optional(),
        clientId: Joi.string().optional(),
        titleId: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        sandbox: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const result = await authorizeSisuSession(value);
    res.json({
        ...result,
        proofKeyHeader: encodeProofKeyHeader(result.proofKeyJwk),
        warning: "Store proofKeyJwk with the returned device/title/user tokens if you want later signed XSAPI requests."
    });
}));

router.post("/xsts", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        proofKeyJwk: Joi.object().required(),
        relyingParty: Joi.string().required(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        optionalDisplayClaims: Joi.array().items(Joi.string().max(128)).max(32).unique().optional(),
        deviceType: Joi.string().optional(),
        deviceVersion: Joi.string().optional(),
        userAgent: Joi.string().optional(),
        clientId: Joi.string().optional(),
        titleId: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        sandbox: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const token = await authorizeXstsSigned(value);
    res.json({token});
}));

router.post("/nsal/resolve", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        url: Joi.string().uri().required(),
        proofKeyJwk: Joi.object().optional(),
        xboxliveToken: Joi.string().optional(),
        titleIds: Joi.array().items(Joi.string().max(64)).max(16).unique().optional(),
        titleData: Joi.alternatives().try(Joi.object(), Joi.array()).optional()
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const context = readXsapiContext(req);
    const result = await resolveNsal(value.url, {
        xboxliveToken: value.xboxliveToken || context.xboxliveToken,
        proofKeyJwk: value.proofKeyJwk || context.proofKeyJwk,
        titleIds: value.titleIds,
        titleData: value.titleData
    });
    res.json({
        source: result.source,
        endpoint: result.endpoint,
        policy: result.policy
    });
}));

router.post("/signature", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        method: Joi.string().default("GET"),
        url: Joi.string().uri().required(),
        authorization: Joi.string().allow("").default(""),
        headers: Joi.object().default({}),
        body: Joi.any().optional(),
        proofKeyJwk: Joi.object().required(),
        policy: Joi.object().default({Version: 1})
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const signature = signXboxRequest(value);
    res.json({signature});
}));

router.post("/request", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        method: Joi.string().valid("GET", "POST", "PUT", "PATCH", "DELETE").default("GET"),
        url: Joi.string().uri({scheme: ["https"]}).required(),
        body: Joi.any().optional(),
        headers: Joi.object().default({}),
        contractVersion: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        sign: Joi.boolean().default(true),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional(),
        relyingParty: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const forbiddenHeaders = new Set(["authorization", "signature", "host", "content-length", "transfer-encoding"]);
    const suppliedForbiddenHeader = Object.keys(value.headers || {}).find(name => forbiddenHeaders.has(name.toLowerCase()));
    if (suppliedForbiddenHeader) throw badRequest(`Header ${suppliedForbiddenHeader} must be supplied through the authenticated XSAPI context`);
    const context = readXsapiContext(req);
    const result = await xsapiRequest({
        method: value.method,
        url: assertXsapiRequestUrl(value.url),
        body: value.body,
        headers: value.headers,
        contractVersion: value.contractVersion,
        sign: value.sign,
        authContext: {
            ...context,
            proofKeyJwk: value.proofKeyJwk || context.proofKeyJwk,
            deviceToken: value.deviceToken || context.deviceToken,
            titleToken: value.titleToken || context.titleToken,
            userToken: value.userToken || context.userToken,
            authorizationToken: value.authorizationToken || context.authorizationToken,
            xstsTokens: value.xstsTokens || context.xstsTokens,
            relyingParty: value.relyingParty || context.relyingParty
        }
    });
    res.status(result.status).json({data: result.data, nsal: result.nsal});
}));

export default router;
