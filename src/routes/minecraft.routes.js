import express from "express";
import Joi from "joi";
import { jwtMiddleware } from "../utils/jwt.js";
import { asyncHandler } from "../utils/async.js";
import { getMCToken } from "../services/minecraft.service.js";
import { badRequest } from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * /minecraft/token:
 *   post:
 *     summary: Neuen Minecraft Multiplayer Token aus PlayFab SessionTicket erzeugen
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
 *     responses:
 *       200:
 *         description: OK
 */
router.post("/token", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({ sessionTicket: Joi.string().required() });
    const { value, error } = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const mcToken = await getMCToken(value.sessionTicket);
    res.json({ mcToken });
}));

export default router;
