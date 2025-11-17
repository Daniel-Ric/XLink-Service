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
 *     summary: Resolve XUID by Gamertag
 *     description: >
 *       Looks up a player's Xbox user ID (XUID) by Gamertag using the Xbox profile service.
 *       Returns 404 if the Gamertag cannot be resolved.
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
 *         description: Exact Gamertag to resolve (without the #suffix used on PC)
 *     responses:
 *       200:
 *         description: XUID successfully resolved
 *       404:
 *         description: Gamertag not found
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
 *     summary: Resolve Gamertag by XUID
 *     description: >
 *       Looks up a player's Gamertag for a given XUID. This uses profile settings under the hood
 *       and returns 404 if the profile cannot be found.
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
 *         description: Xbox user ID (numeric XUID)
 *     responses:
 *       200:
 *         description: Gamertag successfully resolved
 *       404:
 *         description: XUID not found
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
