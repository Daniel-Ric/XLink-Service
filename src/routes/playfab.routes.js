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
 *     description: Convenience wrapper around PlayFab Client APIs authenticated with a SessionTicket.
 */

/**
 * @swagger
 * /playfab/account:
 *   post:
 *     summary: Get PlayFab account info
 *     description: >
 *       Calls PlayFab Client/GetAccountInfo for the provided SessionTicket and returns the
 *       PlayFab account data such as user info and linked platform accounts.
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
 *               sessionTicket: { type: string, description: "PlayFab SessionTicket (X-Authorization)" }
 *     responses:
 *       200:
 *         description: PlayFab account information
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
 *     summary: Fetch PlayFab player profile for a SessionTicket or PlayFabId
 *     description: >
 *       Convenience wrapper around PlayFab **Client/GetPlayerProfile**.
 *       By default, the endpoint fetches the profile of the player that owns the provided
 *       `sessionTicket`.
 *       If you additionally provide a `playFabId`, the service will request the profile
 *       for that specific player instead (for example for admin, support or debugging tools),
 *       assuming your title is configured to allow this.
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionTicket
 *             properties:
 *               sessionTicket:
 *                 type: string
 *                 description: >
 *                   PlayFab **SessionTicket** for the logged-in player.
 *                   Used as `X-Authorization` when calling the PlayFab Client API.
 *               playFabId:
 *                 type: string
 *                 description: >
 *                   Optional PlayFab player ID whose profile should be fetched.
 *                   If omitted, the profile of the player associated with `sessionTicket`
 *                   is returned.
 *     responses:
 *       200:
 *         description: >
 *           Player profile data as returned by **Client/GetPlayerProfile**.
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
 *     summary: Retrieve catalog items for the current PlayFab title
 *     description: >
 *       Wraps the PlayFab **Client/GetCatalogItems** endpoint.
 *       Returns the catalog items for the configured title (via `PLAYFAB_TITLE_ID`).
 *       You may optionally specify a custom `catalogVersion`; if omitted, the default catalog
 *       version for the title is used.
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionTicket
 *             properties:
 *               sessionTicket:
 *                 type: string
 *                 description: >
 *                   PlayFab **SessionTicket** used to authorize the Client API call.
 *               catalogVersion:
 *                 type: string
 *                 description: >
 *                   Optional catalog version name.
 *                   If not provided, PlayFab’s default catalog for the title is queried.
 *     responses:
 *       200:
 *         description: >
 *           Catalog payload from **Client/GetCatalogItems**, including the list of catalog items.
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
 *     summary: Read title-level configuration values (TitleData)
 *     description: >
 *       Wraps the PlayFab **Client/GetTitleData** endpoint.
 *       Use this to fetch game-wide configuration entries (TitleData) such as feature flags,
 *       balance values, or URLs that are not player-specific.
 *       If `keys` is omitted or empty, PlayFab will return all available TitleData entries for
 *       the title (which can be large).
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionTicket
 *             properties:
 *               sessionTicket:
 *                 type: string
 *                 description: >
 *                   PlayFab **SessionTicket** used as client authorization when reading TitleData.
 *               keys:
 *                 type: array
 *                 description: >
 *                   Optional list of TitleData keys to fetch.
 *                   If omitted or empty, all TitleData entries may be returned.
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: >
 *           TitleData dictionary as returned by **Client/GetTitleData**.
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
 *     summary: Read user-specific data (mutable UserData)
 *     description: >
 *       Wraps the PlayFab **Client/GetUserData** endpoint.
 *       Returns per-player **UserData** (mutable key/value pairs) which can be used for
 *       custom progression, settings, or other gameplay-related state.
 *       By default, data is read for the player associated with the `sessionTicket`, but
 *       you may optionally specify a `playFabId` to target another player (subject to title
 *       permissions).
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionTicket
 *             properties:
 *               sessionTicket:
 *                 type: string
 *                 description: >
 *                   PlayFab **SessionTicket** used as `X-Authorization` in the Client call.
 *               playFabId:
 *                 type: string
 *                 description: >
 *                   Optional PlayFab player ID whose UserData should be read.
 *                   If omitted, the player bound to `sessionTicket` is used.
 *               keys:
 *                 type: array
 *                 description: >
 *                   Optional list of UserData keys to fetch.
 *                   If omitted or empty, all user data keys for that player are returned
 *                   (which may be a lot).
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: >
 *           UserData block as returned by **Client/GetUserData** (keys, values, timestamps).
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
 *     summary: Read user-specific read-only data (UserReadOnlyData)
 *     description: >
 *       Wraps the PlayFab **Client/GetUserReadOnlyData** endpoint.
 *       Returns per-player **read-only** data, typically written by server-side logic or
 *       administrative tools and not modifiable by the client.
 *       This is useful for authoritative configuration or progression values that the
 *       game client should never update directly.
 *     tags: [PlayFab]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionTicket
 *             properties:
 *               sessionTicket:
 *                 type: string
 *                 description: >
 *                   PlayFab **SessionTicket** used as client authorization when querying
 *                   read-only user data.
 *               playFabId:
 *                 type: string
 *                 description: >
 *                   Optional PlayFab player ID for which read-only data should be fetched.
 *                   If omitted, the player bound to `sessionTicket` is used.
 *               keys:
 *                 type: array
 *                 description: >
 *                   Optional list of read-only user data keys to fetch.
 *                   If omitted or empty, all read-only keys for that player are returned.
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: >
 *           Read-only user data as returned by **Client/GetUserReadOnlyData**.
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
