import express from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import { jwtMiddleware } from "../utils/jwt.js";
import { asyncHandler } from "../utils/async.js";
import { badRequest } from "../utils/httpError.js";

const router = express.Router();

function b64urlToString(s) {
    let t = String(s || "");
    t = t.replace(/-/g, "+").replace(/_/g, "/");
    const pad = t.length % 4;
    if (pad) t += "=".repeat(4 - pad);
    return Buffer.from(t, "base64").toString("utf8");
}

function tryParseJson(s) {
    try { return JSON.parse(s); } catch { return null; }
}

function normalizeToken(tok) {
    let t = String(tok || "").trim();
    let prefix = null;
    let uhs = null;
    if (/^Bearer\s+/i.test(t)) {
        prefix = "Bearer";
        t = t.replace(/^Bearer\s+/i, "").trim();
    }
    if (/^XBL3\.0\s/i.test(t)) {
        prefix = "XBL3.0";
        const m = t.match(/^XBL3\.0\s+x=([^;]+);(.+)$/i);
        if (m) {
            uhs = m[1];
            t = m[2].trim();
        } else {
            t = t.replace(/^XBL3\.0\s+/i, "").trim();
        }
    }
    if (/^MCToken\s+/i.test(t)) {
        prefix = "MCToken";
        t = t.replace(/^MCToken\s+/i, "").trim();
    }
    return { raw: t, prefix, uhs };
}

function decodeCompact(raw) {
    const parts = String(raw || "").split(".");
    if (parts.length === 3) {
        const h = tryParseJson(b64urlToString(parts[0]));
        const p = tryParseJson(b64urlToString(parts[1]));
        if (h && p) return { kind: "JWS", header: h, payload: p };
    }
    if (parts.length === 5) {
        const h = tryParseJson(b64urlToString(parts[0]));
        if (h) return { kind: "JWE", header: h, payload: null };
    }
    return null;
}

function decodeOne(input) {
    const { raw, prefix, uhs } = normalizeToken(input);
    const cp = decodeCompact(raw);
    let header = null;
    let payload = null;
    let ok = false;
    let kind = null;
    if (cp && cp.kind === "JWS") {
        header = cp.header;
        payload = cp.payload;
        ok = true;
        kind = "JWS";
    } else if (cp && cp.kind === "JWE") {
        header = cp.header;
        payload = null;
        ok = true;
        kind = "JWE";
    } else {
        const dec = jwt.decode(raw, { complete: true });
        if (dec) {
            header = dec.header || null;
            payload = dec.payload || null;
            ok = true;
            kind = "JWS";
        }
    }
    let hasExp = false;
    let secondsRemaining = null;
    const now = Math.floor(Date.now() / 1000);
    if (payload && typeof payload.exp === "number") {
        hasExp = true;
        secondsRemaining = payload.exp - now;
    }
    if (!ok && /^[A-Za-z0-9+/=.-]+$/.test(raw) && raw.length > 40 && raw.includes("-")) {
        header = { typ: "PlayFabSessionTicket" };
        payload = { length: raw.length };
        ok = true;
        kind = "OPAQUE";
    }
    return {
        ok,
        header,
        payload,
        meta: {
            prefix,
            uhs,
            hasExp,
            secondsRemaining,
            rawLength: raw?.length || 0,
            kind
        }
    };
}

router.post("/decode-token", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        token: Joi.string(),
        type: Joi.string().valid("jwt", "xsts", "mc"),
        tokens: Joi.object().pattern(/.*/, Joi.string())
    });
    const { value, error } = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    if (value.tokens && typeof value.tokens === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value.tokens)) out[k] = decodeOne(v);
        return res.json({ ok: true, decoded: out });
    }
    if (!value.token) throw badRequest("token or tokens is required");
    const result = decodeOne(value.token);
    res.json(result);
}));

router.post("/decode-callback", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        jwt: Joi.string().optional(),
        xuid: Joi.string().optional(),
        gamertag: Joi.string().optional(),
        xboxliveToken: Joi.string().optional(),
        playfabToken: Joi.string().optional(),
        redeemToken: Joi.string().optional(),
        mcToken: Joi.string().optional(),
        sessionTicket: Joi.string().optional(),
        playFabId: Joi.string().optional(),
        msAccessToken: Joi.string().optional(),
        msRefreshToken: Joi.string().optional(),
        xblToken: Joi.string().optional(),
        xstsXbox: Joi.string().optional(),
        xstsRedeem: Joi.string().optional(),
        xstsPlayFab: Joi.string().optional()
    }).min(1);
    const { value, error } = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    const decoded = {};
    if (value.jwt) decoded.jwt = decodeOne(value.jwt);
    if (value.xboxliveToken) decoded.xboxliveToken = decodeOne(value.xboxliveToken);
    if (value.playfabToken) decoded.playfabToken = decodeOne(value.playfabToken);
    if (value.redeemToken) decoded.redeemToken = decodeOne(value.redeemToken);
    if (value.mcToken) decoded.mcToken = decodeOne(value.mcToken);
    if (value.sessionTicket) decoded.sessionTicket = decodeOne(value.sessionTicket);
    if (value.msAccessToken) decoded.msAccessToken = decodeOne(value.msAccessToken);
    if (value.xblToken) decoded.xblToken = decodeOne(value.xblToken);
    if (value.xstsXbox) decoded.xstsXbox = decodeOne(value.xstsXbox);
    if (value.xstsRedeem) decoded.xstsRedeem = decodeOne(value.xstsRedeem);
    if (value.xstsPlayFab) decoded.xstsPlayFab = decodeOne(value.xstsPlayFab);
    const user = {
        xuid: value.xuid || decoded.jwt?.payload?.xuid || null,
        gamertag: value.gamertag || decoded.jwt?.payload?.gamertag || null,
        playFabId: value.playFabId || null
    };
    res.json({ user, decoded });
}));

export default router;
