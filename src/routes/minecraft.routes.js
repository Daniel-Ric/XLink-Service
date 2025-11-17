import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {getMCToken} from "../services/minecraft.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * /minecraft/token:
 *   post:
 *     summary: Create a new Minecraft multiplayer token from a PlayFab SessionTicket
 *     description: >
 *       Exchanges a PlayFab SessionTicket for a Minecraft multiplayer authorization header
 *       (MCToken …). This token can be used against Minecraft services and for Marketplace
 *       inventory calls in other endpoints.
 *     tags: [Minecraft]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionTicket]
 *             properties:
 *               sessionTicket:
 *                 type: string
 *                 description: PlayFab SessionTicket obtained from the login flow
 *     responses:
 *       200:
 *         description: Minecraft multiplayer token successfully issued
 */
router.post("/token", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({sessionTicket: Joi.string().required()});
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const mcToken = await getMCToken(value.sessionTicket);
    res.json({mcToken});
}));

export default router;
