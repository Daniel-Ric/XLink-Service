import express from "express";
import Joi from "joi";

import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";
import {sendMarketplaceMessageEvents, startMarketplaceMessagingSession} from "../services/minecraft.service.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Messaging
 *     description: Minecraft Marketplace inbox and messaging APIs.
 */

/**
 * @swagger
 * /messaging/inbox/start:
 *   post:
 *     summary: Start or resume a Marketplace inbox session
 *     description: |
 *       Starts a Marketplace messaging session and returns the inbox payload from
 *       `messaging.mktpl.minecraft-services.net/api/v1.0/session/start`.
 *
 *       **What you must provide**
 *       - Header `x-mc-token`: the full Marketplace authorization header (starts with `MCToken ...`)
 *
 *       **Optional inputs (body)**
 *       - `continuationToken`: resume pagination
 *       - `previousSessionId`: last session id for continuity
 *       - `sessionContext`: optional context string
 *       - `sessionId`: provide a fixed session id instead of auto-generated
 *
 *       **Optional headers**
 *       - `x-mc-session-id`: override the session-id header sent to Marketplace
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Marketplace authorization header (must be the full value, e.g. `MCToken eyJ...`)
 *       - in: header
 *         name: x-mc-session-id
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional session id header passed to the Marketplace messaging service
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               continuationToken:
 *                 type: string
 *               previousSessionId:
 *                 type: string
 *               sessionContext:
 *                 type: string
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Marketplace messaging session payload
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(["/inbox/start", "/session/start"], jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");

    const schema = Joi.object({
        continuationToken: Joi.string().optional(),
        previousSessionId: Joi.string().optional(),
        sessionContext: Joi.string().allow("").default(""),
        sessionId: Joi.string().optional()
    });

    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    const sessionHeaderId = req.headers["x-mc-session-id"] || req.headers["session-id"];

    const result = await startMarketplaceMessagingSession(mcToken, {
        continuationToken: value.continuationToken,
        previousSessionId: value.previousSessionId,
        sessionContext: value.sessionContext,
        sessionId: value.sessionId,
        sessionHeaderId
    });

    const headerSessionId = result.headers?.["session-id"] || result.sessionHeaderId;
    if (headerSessionId) res.setHeader("Session-Id", headerSessionId);

    res.json(result.data);
}));

/**
 * @swagger
 * /messaging/inbox/event:
 *   post:
 *     summary: Send inbox events (impression or delete)
 *     description: |
 *       Sends Marketplace inbox events to mark a message as seen (Impression) or delete it.
 *       Proxies `messaging.mktpl.minecraft-services.net/api/v1.0/messages/event`.
 *
 *       **What you must provide**
 *       - Header `x-mc-token`: the full Marketplace authorization header (starts with `MCToken ...`)
 *       - Body fields required for an event
 *
 *       **Simplest body**
 *       - `sessionId`
 *       - `instanceId`
 *       - `reportId`
 *       - `eventType`: `Impression` or `Delete`
 *
 *       **Advanced body**
 *       - `events`: array of events (each with `instanceId`, `reportId`, `eventType`, optional `eventDateTime`, `sessionId`)
 *       - `continuationToken`
 *       - `sessionContext`
 *
 *       **Optional headers**
 *       - `x-mc-session-id`: override the session-id header sent to Marketplace
 *     tags: [Messaging]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-mc-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Marketplace authorization header (must be the full value, e.g. `MCToken eyJ...`)
 *       - in: header
 *         name: x-mc-session-id
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional session id header passed to the Marketplace messaging service
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *               sessionContext:
 *                 type: string
 *               continuationToken:
 *                 type: string
 *               eventType:
 *                 type: string
 *                 enum: [Impression, Delete]
 *               instanceId:
 *                 type: string
 *               reportId:
 *                 type: string
 *               eventDateTime:
 *                 type: string
 *                 format: date-time
 *               events:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     eventType:
 *                       type: string
 *                     instanceId:
 *                       type: string
 *                     reportId:
 *                       type: string
 *                     eventDateTime:
 *                       type: string
 *                       format: date-time
 *                     sessionId:
 *                       type: string
 *     responses:
 *       200:
 *         description: Marketplace messaging event response
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/inbox/event", jwtMiddleware, asyncHandler(async (req, res) => {
    const mcToken = req.headers["x-mc-token"];
    if (!mcToken) throw badRequest("Missing x-mc-token header");

    const schema = Joi.object({
        sessionId: Joi.string().optional(),
        sessionContext: Joi.string().allow("").default(""),
        continuationToken: Joi.string().optional(),
        eventType: Joi.string().valid("Impression", "Delete").optional(),
        instanceId: Joi.string().optional(),
        reportId: Joi.string().optional(),
        eventDateTime: Joi.string().optional(),
        events: Joi.array().items(Joi.object({
            eventType: Joi.string().valid("Impression", "Delete").required(),
            instanceId: Joi.string().required(),
            reportId: Joi.string().required(),
            eventDateTime: Joi.string().optional(),
            sessionId: Joi.string().optional()
        })).optional()
    });

    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    const sessionHeaderId = req.headers["x-mc-session-id"] || req.headers["session-id"];

    const result = await sendMarketplaceMessageEvents(mcToken, {
        sessionId: value.sessionId,
        sessionContext: value.sessionContext,
        continuationToken: value.continuationToken,
        eventType: value.eventType,
        instanceId: value.instanceId,
        reportId: value.reportId,
        eventDateTime: value.eventDateTime,
        events: value.events,
        sessionHeaderId
    });

    const headerSessionId = result.headers?.["session-id"] || result.sessionHeaderId;
    if (headerSessionId) res.setHeader("Session-Id", headerSessionId);

    res.json(result.data);
}));

export default router;
