import express from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import {jwtMiddleware} from "../utils/jwt.js";
import {asyncHandler} from "../utils/async.js";
import {badRequest} from "../utils/httpError.js";

const router = express.Router();

function b64urlToString(s) {
    let t = String(s || "");
    t = t.replace(/-/g, "+").replace(/_/g, "/");
    const pad = t.length % 4;
    if (pad) t += "=".repeat(4 - pad);
    return Buffer.from(t, "base64").toString("utf8");
}

function tryParseJson(s) {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
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
    return {raw: t, prefix, uhs};
}

function decodeCompact(raw) {
    const parts = String(raw || "").split(".");
    if (parts.length === 3) {
        const h = tryParseJson(b64urlToString(parts[0]));
        const p = tryParseJson(b64urlToString(parts[1]));
        if (h && p) return {kind: "JWS", header: h, payload: p};
    }
    if (parts.length === 5) {
        const h = tryParseJson(b64urlToString(parts[0]));
        if (h) return {kind: "JWE", header: h, payload: null};
    }
    return null;
}

function decodeOne(input) {
    const {raw, prefix, uhs} = normalizeToken(input);
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
        const dec = jwt.decode(raw, {complete: true});
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
    if (!ok && typeof raw === "string" && raw.trim().length >= 24) {
        header = {typ: "OpaqueToken"};
        payload = {length: raw.length};
        ok = true;
        kind = "OPAQUE";
    }
    return {
        ok, header, payload, meta: {
            prefix, uhs, hasExp, secondsRemaining, rawLength: raw?.length || 0, kind
        }
    };
}

router.post("/decode-token", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object({
        token: Joi.string(),
        type: Joi.string().valid("jwt", "xsts", "mc"),
        tokens: Joi.object().pattern(/.*/, Joi.string())
    });
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);
    if (value.tokens && typeof value.tokens === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value.tokens)) out[k] = decodeOne(v);
        return res.json({ok: true, decoded: out});
    }
    if (!value.token) throw badRequest("token or tokens is required");
    const result = decodeOne(value.token);
    res.json(result);
}));

router.post("/decode-callback", jwtMiddleware, asyncHandler(async (req, res) => {
    const schema = Joi.object().unknown(true);
    const {value, error} = schema.validate(req.body || {});
    if (error) throw badRequest(error.message);

    const src = value || {};
    const bundle = (src.callback && typeof src.callback === "object") ? src.callback : src;

    const get = (obj, path) => {
        try {
            return path.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
        } catch {
            return undefined;
        }
    };

    const extracted = {
        jwt: bundle.jwt,
        xuid: bundle.xuid,
        gamertag: bundle.gamertag,
        uhs: bundle.uhs,
        msAccessToken: bundle.msAccessToken,
        msRefreshToken: bundle.msRefreshToken,
        xblToken: bundle.xblToken,
        xboxliveToken: bundle.xboxliveToken,
        playfabToken: bundle.playfabToken,
        redeemToken: bundle.redeemToken,
        mcToken: bundle.mcToken,
        sessionTicket: bundle.sessionTicket,
        playFabId: bundle.playFabId,
        entityToken: bundle.entityToken,
        entityTokenMaster: bundle.entityTokenMaster,
        xstsXbox: bundle.xstsXbox,
        xstsRedeem: bundle.xstsRedeem,
        xstsPlayFab: bundle.xstsPlayFab
    };

    const xstsXboxRaw = get(bundle, "xsts.xbox.Token");
    const xstsRedeemRaw = get(bundle, "xsts.redeem.Token");
    const xstsPlayFabRaw = get(bundle, "xsts.playfab.Token");

    extracted.xstsXbox = extracted.xstsXbox || xstsXboxRaw;
    extracted.xstsRedeem = extracted.xstsRedeem || xstsRedeemRaw;
    extracted.xstsPlayFab = extracted.xstsPlayFab || xstsPlayFabRaw;

    const uhs = extracted.uhs || get(bundle, "xsts.xbox.DisplayClaims.xui.0.uhs") || get(bundle, "xsts.redeem.DisplayClaims.xui.0.uhs") || get(bundle, "xsts.playfab.DisplayClaims.xui.0.uhs");

    if (uhs) extracted.uhs = uhs;

    if (!extracted.xboxliveToken && extracted.xstsXbox && extracted.uhs) {
        extracted.xboxliveToken = `XBL3.0 x=${extracted.uhs};${extracted.xstsXbox}`;
    }
    if (!extracted.redeemToken && extracted.xstsRedeem && extracted.uhs) {
        extracted.redeemToken = `XBL3.0 x=${extracted.uhs};${extracted.xstsRedeem}`;
    }
    if (!extracted.playfabToken && extracted.xstsPlayFab && extracted.uhs) {
        extracted.playfabToken = `XBL3.0 x=${extracted.uhs};${extracted.xstsPlayFab}`;
    }

    const decoded = {};
    const add = (key, val) => {
        if (val == null) return;
        if (typeof val !== "string") return;
        if (!val.trim()) return;
        decoded[key] = decodeOne(val);
    };

    add("jwt", extracted.jwt);
    add("msAccessToken", extracted.msAccessToken);
    add("msRefreshToken", extracted.msRefreshToken);
    add("xblToken", extracted.xblToken);

    add("xstsXbox", extracted.xstsXbox);
    add("xstsRedeem", extracted.xstsRedeem);
    add("xstsPlayFab", extracted.xstsPlayFab);

    add("xboxliveToken", extracted.xboxliveToken);
    add("redeemToken", extracted.redeemToken);
    add("playfabToken", extracted.playfabToken);

    add("mcToken", extracted.mcToken);
    add("sessionTicket", extracted.sessionTicket);
    add("entityToken", extracted.entityToken);
    add("entityTokenMaster", extracted.entityTokenMaster);

    const user = {
        xuid: extracted.xuid || decoded.jwt?.payload?.xuid || get(bundle, "xsts.xbox.DisplayClaims.xui.0.xid") || null,
        gamertag: extracted.gamertag || decoded.jwt?.payload?.gamertag || get(bundle, "xsts.xbox.DisplayClaims.xui.0.gtg") || null,
        playFabId: extracted.playFabId || null,
        uhs: extracted.uhs || null
    };

    res.json({user, decoded});
}));

export default router;
