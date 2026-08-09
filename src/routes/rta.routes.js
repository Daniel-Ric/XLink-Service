import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";
import {readXsapiContext} from "../utils/xsapiContext.js";
import {
    closeRtaConnection,
    createRtaConnection,
    getRtaConnection,
    listRtaConnections
} from "../services/rta.service.js";

const router = express.Router();

function requireAuthContext(req) {
    const context = readXsapiContext(req);
    if (!context.xboxliveToken) throw badRequest("Missing x-xbl-token header");
    return context;
}

router.get("/", jwtMiddleware, asyncHandler(async (req, res) => {
    res.json({connections: listRtaConnections(req.user.xuid)});
}));

router.post("/connect", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        proofKeyJwk: Joi.object().optional(),
        deviceToken: Joi.object().optional(),
        titleToken: Joi.object().optional(),
        userToken: Joi.object().optional(),
        authorizationToken: Joi.alternatives().try(Joi.object(), Joi.string()).optional(),
        xstsTokens: Joi.object().optional()
    });
    const {error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const connection = await createRtaConnection(requireAuthContext(req), req.user.xuid);
    res.status(201).json({connection});
}));

router.get("/:id", jwtMiddleware, asyncHandler(async (req, res) => {
    res.json({connection: getRtaConnection(req.params.id, req.user.xuid).snapshot()});
}));

router.post("/:id/subscribe", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        resourceUri: Joi.string().uri({scheme: ["https"]}).max(2048).required()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const subscription = await getRtaConnection(req.params.id, req.user.xuid).subscribe(value.resourceUri);
    res.status(201).json({subscription});
}));

router.post("/:id/unsubscribe", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        subscriptionId: Joi.number().integer().min(0).required()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const result = await getRtaConnection(req.params.id, req.user.xuid).unsubscribe(value.subscriptionId);
    res.json(result);
}));

router.get("/:id/events", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        since: Joi.number().integer().min(0).default(0)
    });
    const {value, error} = schema.validate(req.query);
    if (error) throw badRequest(error.message);
    const connection = getRtaConnection(req.params.id, req.user.xuid);
    res.json({
        connection: connection.snapshot(),
        events: connection.eventSlice(value.since)
    });
}));

router.delete("/:id", jwtMiddleware, asyncHandler(async (req, res) => {
    res.json(closeRtaConnection(req.params.id, req.user.xuid));
}));

export default router;
