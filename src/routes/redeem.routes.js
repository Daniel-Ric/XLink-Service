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
 *     description: Microsoft RedeemNow flow (PrepareRedeem lookup + RedeemToken redeem) via Store Web Dynamics.
 */

/**
 * @swagger
 * /redeem/lookup:
 *   post:
 *     summary: Lookup a redeem code (PrepareRedeem / LookupToken)
 *     description: |
 *       Runs the same **PrepareRedeem** call used by the official Microsoft redeem page.
 *
 *       **You must provide**
 *       - Header `x-redeem-token`: XSTS token in format `XBL3.0 x=<uhs>;<token>`
 *
 *       **Where does `x-redeem-token` come from?**
 *       - Call `POST /auth/callback` in this API and take the redeem XSTS token from that response.
 *
 *       **What this endpoint does**
 *       - Calls: `POST https://buynow.production.store-web.dynamics.com/v1.0/Redeem/PrepareRedeem?appId=RedeemNow&context=LookupToken`
 *       - Forwards the redeem XSTS token as `Authorization` and sends the same headers/body shape as the browser flow.
 *
 *       **What you get back**
 *       - The raw lookup JSON (e.g. gift card value/currency or entitlement details).
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
 *           example: "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
 *         description: Optional. If omitted, `locale` is used and defaults to `en-US`.
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
 *                 description: Redeem code to look up.
 *               market:
 *                 type: string
 *                 default: "US"
 *                 description: Store market (country) code. Example `DE`, `US`.
 *               locale:
 *                 type: string
 *                 default: "en-US"
 *                 description: UI locale. Used to derive the Store `language` field for lookup. Example `de-DE`.
 *           example:
 *             code: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
 *             market: "DE"
 *             locale: "de-DE"
 *     responses:
 *       200:
 *         description: Raw PrepareRedeem response.
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

    const acceptLanguage = req.headers["accept-language"];
    const locale = value.locale || acceptLanguage || "en-US";
    const market = value.market || "US";

    const flow = {
        muid: crypto.randomBytes(16).toString("hex").toUpperCase(),
        correlationId: crypto.randomUUID(),
        referenceId: crypto.randomBytes(32).toString("hex").toUpperCase(),
        trackingId: crypto.randomUUID(),
        vectorId: crypto.randomBytes(32).toString("hex").toUpperCase(),
        cvBase: "FIzDSTrg7TZ2naZyEL1T/P",
        acceptLanguage: acceptLanguage || String(locale)
    };

    const data = await prepareRedeem(redeemToken, {code: value.code, market, locale}, flow);

    res.json(data);
}));

/**
 * @swagger
 * /redeem/redeem:
 *   post:
 *     summary: Redeem a code (PrepareRedeem + RedeemToken)
 *     description: |
 *       Redeems a code using the same two requests as the official redeem page:
 *       1) **PrepareRedeem** (`context=LookupToken`)
 *       2) **RedeemToken**
 *
 *       **You must provide**
 *       - Header `x-redeem-token`: XSTS token in format `XBL3.0 x=<uhs>;<token>`
 *
 *       **Where does `x-redeem-token` come from?**
 *       - Call `POST /auth/callback` in this API and take the redeem XSTS token from that response.
 *
 *       **Do I need to provide `paymentSessionId`?**
 *       - **No.** The server generates a UUID v4 automatically and sends it to Microsoft.
 *
 *       **What this endpoint does**
 *       - Calls:
 *         - `POST https://buynow.production.store-web.dynamics.com/v1.0/Redeem/PrepareRedeem?appId=RedeemNow&context=LookupToken`
 *         - `POST https://buynow.production.store-web.dynamics.com/v1.0/Redeem/RedeemToken?appId=RedeemNow`
 *       - Uses the same headers/body shape as the browser flow (including `flights`).
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
 *           example: "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
 *         description: Optional. If omitted, `locale` is used and defaults to `en-US`.
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
 *                 description: Redeem code to redeem.
 *               market:
 *                 type: string
 *                 default: "US"
 *                 description: Store market (country) code. Example `DE`, `US`.
 *               locale:
 *                 type: string
 *                 default: "en-US"
 *                 description: UI locale. Used to send `language` in lookup and `locale` in redeem. Example `de-DE`.
 *           example:
 *             code: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
 *             market: "DE"
 *             locale: "de-DE"
 *     responses:
 *       200:
 *         description: Object containing both lookup and redeem raw responses.
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

    const acceptLanguage = req.headers["accept-language"];
    const locale = value.locale || acceptLanguage || "en-US";
    const market = value.market || "US";

    const flow = {
        muid: crypto.randomBytes(16).toString("hex").toUpperCase(),
        correlationId: crypto.randomUUID(),
        referenceId: crypto.randomBytes(32).toString("hex").toUpperCase(),
        trackingId: crypto.randomUUID(),
        vectorId: crypto.randomBytes(32).toString("hex").toUpperCase(),
        cvBase: "FIzDSTrg7TZ2naZyEL1T/P",
        acceptLanguage: acceptLanguage || String(locale)
    };

    const lookup = await prepareRedeem(redeemToken, {code: value.code, market, locale}, flow);

    const paymentSessionId = crypto.randomUUID();

    const redeemed = await redeemCode(redeemToken, {code: value.code, paymentSessionId, market, locale}, flow);

    res.json({lookup, redeem: redeemed});
}));

export default router;
