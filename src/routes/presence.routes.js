import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getPresence, getPresenceBatch} from "../services/xbox.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * /presence/me:
 *   get:
 *     summary: Presence des Users
 *     tags: [Presence]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Presence
 */
router.get("/me", jwtMiddleware, asyncHandler(async (req, res) => {
    const {xuid} = req.user;
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");
    const presence = await getPresence(xuid, xboxliveToken);
    res.json(presence);
}));

/**
 * @swagger
 * /presence/batch:
 *   post:
 *     summary: Presence für mehrere XUIDs
 *     tags: [Presence]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [xuids]
 *             properties:
 *               xuids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Presence batch
 */
router.post("/batch", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({xuids: Joi.array().items(Joi.string()).min(1).required()});
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);

    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");

    const data = await getPresenceBatch(value.xuids, xboxliveToken);
    res.json(data);
}));

export default router;
