import express from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import { jwtMiddleware } from "../utils/jwt.js";
import { asyncHandler } from "../utils/async.js";
import { badRequest } from "../utils/httpError.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Debug
 *     description: Hilfsendpunkte (keine Speicherung)
 */

/**
 * @swagger
 * /debug/decode-token:
 *   post:
 *     summary: JWT/XSTS/MC-Token decodieren (ohne Verify)
 *     tags: [Debug]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TokenDecodeRequest'
 *     responses:
 *       200:
 *         description: Header/Payload
 */
router.post("/decode-token", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        token: Joi.string().required(),
        type: Joi.string().valid("jwt", "xsts", "mc").optional()
    });
    const { value, error } = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    let tok = value.token.trim();

    if (/^Bearer\s+/i.test(tok)) tok = tok.replace(/^Bearer\s+/i, "");
    if (/^XBL3\.0\s/i.test(tok)) {
        const semi = tok.indexOf(";");
        tok = semi >= 0 ? tok.slice(semi + 1).trim() : tok;
    }
    if (/^MCToken\s+/i.test(tok)) tok = tok.replace(/^MCToken\s+/i, "");

    const decoded = jwt.decode(tok, { complete: true });
    if (!decoded) {
        return res.json({ ok: false, reason: "Not a JWT or could not decode." });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = decoded.payload?.exp;
    res.json({
        ok: true,
        header: decoded.header,
        payload: decoded.payload,
        meta: {
            hasExp: typeof exp === "number",
            secondsRemaining: typeof exp === "number" ? (exp - now) : null
        }
    });
}));

export default router;
