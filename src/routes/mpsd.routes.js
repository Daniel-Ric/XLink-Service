import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";
import {readXsapiContext} from "../utils/xsapiContext.js";
import {
    closeSession,
    getSession,
    inviteToSession,
    joinSession,
    listMpsdSessions,
    publishSession,
    queryActivities,
    setMemberCustomProperties,
    setSessionCustomProperties,
    writeActivity
} from "../services/mpsd.service.js";

const router = express.Router();

function refFromParams(params) {
    return {
        scid: params.scid,
        templateName: params.templateName,
        name: params.name
    };
}

function requireAuthContext(req) {
    const context = readXsapiContext(req);
    if (!context.xboxliveToken) throw badRequest("Missing x-xbl-token header");
    return {...context, xuid: req.user?.xuid};
}

const refSchema = {
    scid: Joi.string().guid().required(),
    templateName: Joi.string().min(1).required(),
    name: Joi.string().min(1).required()
};

router.get("/sessions", jwtMiddleware, asyncHandler(async (req, res) => {
    res.json({sessions: listMpsdSessions(req.user.xuid)});
}));

router.post("/activities", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        scid: Joi.string().guid().required(),
        xuids: Joi.array().items(Joi.string()).max(100).default([]),
        socialGroup: Joi.string().valid("people", "favorites").default("people"),
        include: Joi.string().default("relatedInfo,customProperties"),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const result = await queryActivities(value, requireAuthContext(req));
    res.json({activities: result.activities, raw: result.data, nsal: result.nsal});
}));

router.post("/sessions", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        scid: Joi.string().guid().required(),
        templateName: Joi.string().min(1).required(),
        name: Joi.string().allow("").optional(),
        customProperties: Joi.any().optional(),
        customConstants: Joi.any().optional(),
        customMemberProperties: Joi.any().optional(),
        customMemberConstants: Joi.any().optional(),
        joinRestriction: Joi.string().default("followed"),
        readRestriction: Joi.string().default("followed"),
        connectionId: Joi.string().guid().optional(),
        subscriptionId: Joi.string().guid().optional(),
        writeActivity: Joi.boolean().default(true),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const result = await publishSession({
        scid: value.scid,
        templateName: value.templateName,
        name: value.name
    }, value, requireAuthContext(req));
    res.status(201).json({ref: result.ref, session: result.data, nsal: result.nsal});
}));

router.post("/join", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        handleId: Joi.string().guid().required(),
        customMemberProperties: Joi.any().optional(),
        customMemberConstants: Joi.any().optional(),
        connectionId: Joi.string().guid().optional(),
        subscriptionId: Joi.string().guid().optional(),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const result = await joinSession(value.handleId, value, requireAuthContext(req));
    res.json({ref: result.ref, session: result.data, nsal: result.nsal});
}));

router.get("/sessions/:scid/:templateName/:name", jwtMiddleware, asyncHandler(async (req, res) => {
    const {error} = Joi.object(refSchema).validate(req.params);
    if (error) throw badRequest(error.message);
    const result = await getSession(refFromParams(req.params), requireAuthContext(req));
    res.json({session: result.data, nsal: result.nsal});
}));

router.post("/sessions/:scid/:templateName/:name/activity", jwtMiddleware, asyncHandler(async (req, res) => {
    const {error} = Joi.object(refSchema).validate(req.params);
    if (error) throw badRequest(error.message);
    const result = await writeActivity(refFromParams(req.params), requireAuthContext(req));
    res.json({handle: result.data, nsal: result.nsal});
}));

router.post("/sessions/:scid/:templateName/:name/invite", jwtMiddleware, asyncHandler(async (req, res) => {
    const paramResult = Joi.object(refSchema).validate(req.params);
    if (paramResult.error) throw badRequest(paramResult.error.message);
    const schema = Joi.object({
        xuid: Joi.string().required(),
        titleId: Joi.string().required(),
        contextString: Joi.string().optional(),
        context: Joi.string().optional(),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const result = await inviteToSession(refFromParams(req.params), value, requireAuthContext(req));
    res.json({invite: result.data, nsal: result.nsal});
}));

router.patch("/sessions/:scid/:templateName/:name/properties", jwtMiddleware, asyncHandler(async (req, res) => {
    const paramResult = Joi.object(refSchema).validate(req.params);
    if (paramResult.error) throw badRequest(paramResult.error.message);
    const schema = Joi.object({
        customProperties: Joi.any().required(),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const result = await setSessionCustomProperties(refFromParams(req.params), value.customProperties, requireAuthContext(req));
    res.json({session: result.data, nsal: result.nsal});
}));

router.patch("/sessions/:scid/:templateName/:name/members/:label/properties", jwtMiddleware, asyncHandler(async (req, res) => {
    const paramResult = Joi.object({...refSchema, label: Joi.string().min(1).required()}).validate(req.params);
    if (paramResult.error) throw badRequest(paramResult.error.message);
    const schema = Joi.object({
        customProperties: Joi.any().required(),
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const result = await setMemberCustomProperties(refFromParams(req.params), req.params.label, value.customProperties, requireAuthContext(req));
    res.json({session: result.data, nsal: result.nsal});
}));

router.delete("/sessions/:scid/:templateName/:name", jwtMiddleware, asyncHandler(async (req, res) => {
    const {error} = Joi.object(refSchema).validate(req.params);
    if (error) throw badRequest(error.message);
    const result = await closeSession(refFromParams(req.params), requireAuthContext(req));
    res.json({ok: true, status: result.status});
}));

export default router;
