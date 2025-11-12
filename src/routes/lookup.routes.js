import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {badRequest, notFound} from "../utils/httpError.js";
import {getGamertagByXuid, getXuidByGamertag} from "../services/xbox.service.js";

const router = express.Router();

/**
 * @swagger
 * /lookup/xuid:
 *   get:
 *     summary: XUID zu Gamertag nachschlagen
 *     tags: [Lookup]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: gamertag
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Gamertag nicht gefunden }
 */
router.get("/xuid", jwtMiddleware, asyncHandler(async (req, res) => {
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");

    const schema = Joi.object({gamertag: Joi.string().min(1).required()});
    const {value, error} = schema.validate(req.query);
    if (error) throw badRequest(error.message);

    const xuid = await getXuidByGamertag(value.gamertag, xboxliveToken);
    if (!xuid) throw notFound(`Gamertag "${value.gamertag}" not found`);

    res.json({gamertag: value.gamertag, xuid});
}));

/**
 * @swagger
 * /lookup/gamertag:
 *   get:
 *     summary: Gamertag zu XUID nachschlagen
 *     tags: [Lookup]
 *     security:
 *       - BearerAuth: []
 *       - XBLToken: []
 *     parameters:
 *       - in: header
 *         name: x-xbl-token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: xuid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: XUID nicht gefunden }
 */
router.get("/gamertag", jwtMiddleware, asyncHandler(async (req, res) => {
    const xboxliveToken = req.headers["x-xbl-token"];
    if (!xboxliveToken) throw badRequest("Missing x-xbl-token header");

    const schema = Joi.object({xuid: Joi.string().min(1).required()});
    const {value, error} = schema.validate(req.query);
    if (error) throw badRequest(error.message);

    const gamertag = await getGamertagByXuid(value.xuid, xboxliveToken);
    if (!gamertag) throw notFound(`XUID "${value.xuid}" not found`);

    res.json({xuid: value.xuid, gamertag});
}));

export default router;
