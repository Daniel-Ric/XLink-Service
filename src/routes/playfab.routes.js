import express from "express";
import Joi from "joi";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {
    getPlayFabAccountInfo,
    getPlayFabCatalog,
    getPlayFabPlayerProfile,
    getPlayFabTitleData,
    getPlayFabUserData,
    getPlayFabUserReadOnlyData
} from "../services/playfab.service.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: PlayFab
 *     description: PlayFab Client Read-APIs (SessionTicket)
 */

/**
 * @swagger
 * /playfab/account:
 *   post:
 *     summary: GetAccountInfo
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionTicket]
 *             properties:
 *               sessionTicket: { type: string }
 *     responses:
 *       200:
 *         description: AccountInfo
 */
router.post("/account", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({sessionTicket: Joi.string().required()});
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const data = await getPlayFabAccountInfo(value.sessionTicket);
    res.json(data);
}));

/**
 * @swagger
 * /playfab/profile:
 *   post:
 *     summary: GetPlayerProfile (optional PlayFabId)
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionTicket]
 *             properties:
 *               sessionTicket: { type: string }
 *               playFabId: { type: string }
 *     responses:
 *       200:
 *         description: PlayerProfile
 */
router.post("/profile", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sessionTicket: Joi.string().required(), playFabId: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const data = await getPlayFabPlayerProfile(value.sessionTicket, value.playFabId);
    res.json(data);
}));

/**
 * @swagger
 * /playfab/catalog:
 *   post:
 *     summary: GetCatalogItems
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionTicket]
 *             properties:
 *               sessionTicket: { type: string }
 *               catalogVersion: { type: string }
 *     responses:
 *       200:
 *         description: Catalog
 */
router.post("/catalog", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sessionTicket: Joi.string().required(), catalogVersion: Joi.string().optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const data = await getPlayFabCatalog(value.sessionTicket, value.catalogVersion);
    res.json(data);
}));

/**
 * @swagger
 * /playfab/titledata:
 *   post:
 *     summary: GetTitleData (optional Keys)
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionTicket]
 *             properties:
 *               sessionTicket: { type: string }
 *               keys:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: TitleData
 */
router.post("/titledata", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sessionTicket: Joi.string().required(), keys: Joi.array().items(Joi.string()).optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const data = await getPlayFabTitleData(value.sessionTicket, value.keys);
    res.json(data);
}));

/**
 * @swagger
 * /playfab/userdata:
 *   post:
 *     summary: GetUserData (optional Keys/PlayFabId)
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionTicket]
 *             properties:
 *               sessionTicket: { type: string }
 *               playFabId: { type: string }
 *               keys:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: UserData
 */
router.post("/userdata", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sessionTicket: Joi.string().required(),
        playFabId: Joi.string().optional(),
        keys: Joi.array().items(Joi.string()).optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const data = await getPlayFabUserData(value.sessionTicket, value.keys, value.playFabId);
    res.json(data);
}));

/**
 * @swagger
 * /playfab/userdata/readonly:
 *   post:
 *     summary: GetUserReadOnlyData (optional Keys/PlayFabId)
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionTicket]
 *             properties:
 *               sessionTicket: { type: string }
 *               playFabId: { type: string }
 *               keys:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: UserReadOnlyData
 */
router.post("/userdata/readonly", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        sessionTicket: Joi.string().required(),
        playFabId: Joi.string().optional(),
        keys: Joi.array().items(Joi.string()).optional()
    });
    const {value, error} = schema.validate(req.body);
    if (error) throw badRequest(error.message);
    const data = await getPlayFabUserReadOnlyData(value.sessionTicket, value.keys, value.playFabId);
    res.json(data);
}));

export default router;
