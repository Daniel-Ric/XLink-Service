import express from "express";
import Joi from "joi";
import crypto from "node:crypto";

import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";
import {prepareRedeem, redeemCode} from "../services/redeem.service.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Redeem
 *     description: RedeemNow / Microsoft Store Redeem flow (Lookup + Redeem).
 */

/**
 * @swagger
 * /redeem/lookup:
 *   post:
 *     summary: Lookup a redeem code (what it contains)
 *     description: |
 *       This endpoint performs the same "lookup" step as the official redeem page.
 *
 *       **What you need to provide**
 *       - `x-redeem-token` header: an XSTS token in `XBL3.0 x=<uhs>;<token>` format.
 *
 *       **Where do I get `x-redeem-token`?**
 *       - Call `POST /auth/callback` in this API. Its response contains the redeem XSTS token which must be forwarded
 *         into this endpoint as the `x-redeem-token` header.
 *
 *       **What does this endpoint do?**
 *       - Calls Microsoft Store "PrepareRedeem" with `context=LookupToken` and returns the raw response.
 *       - Use this to preview if a code is valid and what it would grant (gift card value, entitlement, etc.).
 *     tags: [Redeem]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-redeem-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Redeem XSTS token returned by `POST /auth/callback` (format `XBL3.0 x=<uhs>;<token>`).
 *       - in: header
 *         name: Accept-Language
 *         required: false
 *         schema:
 *           type: string
 *           example: "de-DE,de;q=0.9"
 *         description: Optional locale hint. If not provided, defaults to `en-US`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 description: The redeem code the user wants to check.
 *               market:
 *                 type: string
 *                 default: "US"
 *                 description: Market / country code for the Store API (e.g. `US`, `DE`).
 *               locale:
 *                 type: string
 *                 default: "en-US"
 *                 description: Locale for the Store API (e.g. `en-US`, `de-DE`). If omitted, `Accept-Language` is used.
 *           example:
 *             code: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
 *             market: "DE"
 *             locale: "de-DE"
 *     responses:
 *       200:
 *         description: Raw PrepareRedeem lookup response from Microsoft Store.
 *       400:
 *         description: Validation error / missing headers.
 */
router.post("/lookup", jwtMiddleware, asyncHandler(async (req, res) => {
    const redeemToken = req.headers["x-redeem-token"];
    if (!redeemToken) throw badRequest("Missing x-redeem-token header");

    const schema = Joi.object({
        code: Joi.string().min(4).max(64).required(),
        market: Joi.string().min(2).max(5).optional(),
        locale: Joi.string().min(2).max(32).optional()
    }).unknown(true);

    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    const locale = value.locale || req.headers["accept-language"] || "en-US";
    const market = value.market || "US";

    const data = await prepareRedeem(redeemToken, {code: value.code, market, locale}, {correlationId: req.id});
    res.json(data);
}));

/**
 * @swagger
 * /redeem/redeem:
 *   post:
 *     summary: Redeem a code
 *     description: |
 *       Redeems the provided code by executing the same two-step process as the official redeem flow:
 *       1) PrepareRedeem (lookup)
 *       2) RedeemToken (final redeem)
 *
 *       **What you need to provide**
 *       - `x-redeem-token` header: an XSTS token in `XBL3.0 x=<uhs>;<token>` format.
 *
 *       **Where do I get `x-redeem-token`?**
 *       - Call `POST /auth/callback` in this API. Its response contains the redeem XSTS token which must be forwarded
 *         into this endpoint as the `x-redeem-token` header.
 *
 *       **About `paymentSessionId`**
 *       - You do **not** provide a `paymentSessionId`.
 *       - The server generates a fresh UUID v4 for every redeem call and uses it for the Store redeem request.
 *     tags: [Redeem]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-redeem-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Redeem XSTS token returned by `POST /auth/callback` (format `XBL3.0 x=<uhs>;<token>`).
 *       - in: header
 *         name: Accept-Language
 *         required: false
 *         schema:
 *           type: string
 *           example: "de-DE,de;q=0.9"
 *         description: Optional locale hint. If not provided, defaults to `en-US`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 description: The redeem code the user wants to redeem.
 *               market:
 *                 type: string
 *                 default: "US"
 *                 description: Market / country code for the Store API (e.g. `US`, `DE`).
 *               locale:
 *                 type: string
 *                 default: "en-US"
 *                 description: Locale for the Store API (e.g. `en-US`, `de-DE`). If omitted, `Accept-Language` is used.
 *           example:
 *             code: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
 *             market: "DE"
 *             locale: "de-DE"
 *     responses:
 *       200:
 *         description: Object containing the lookup response and the redeem response.
 *       400:
 *         description: Validation error / missing headers.
 */
router.post("/redeem", jwtMiddleware, asyncHandler(async (req, res) => {
    const redeemToken = req.headers["x-redeem-token"];
    if (!redeemToken) throw badRequest("Missing x-redeem-token header");

    const schema = Joi.object({
        code: Joi.string().min(4).max(64).required(),
        market: Joi.string().min(2).max(5).optional(),
        locale: Joi.string().min(2).max(32).optional()
    }).unknown(true);

    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    const locale = value.locale || req.headers["accept-language"] || "en-US";
    const market = value.market || "US";

    const lookup = await prepareRedeem(redeemToken, {code: value.code, market, locale}, {correlationId: req.id});
    const paymentSessionId = crypto.randomUUID();

    const redeemed = await redeemCode(redeemToken, {
        code: value.code, paymentSessionId, market, locale
    }, {correlationId: req.id});

    res.json({lookup, redeem: redeemed});
}));

export default router;
