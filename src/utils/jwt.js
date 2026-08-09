import jwt from "jsonwebtoken";
import {env} from "../config/env.js";
import {unauthorized} from "./httpError.js";
import {assertTokenBinding} from "./tokenBinding.js";

export function signJwt(payload, expiresIn) {
    const finalExpiresIn = expiresIn || env.JWT_EXPIRES_IN || "1h";
    if (!payload?.xuid || typeof payload.xuid !== "string") {
        throw new TypeError("JWT payload requires a non-empty xuid");
    }
    return jwt.sign({...payload, tokenUse: "access"}, env.JWT_SECRET, {
        algorithm: "HS256",
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        expiresIn: finalExpiresIn
    });
}

export function verifyJwt(token) {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: env.JWT_ISSUER,
            audience: env.JWT_AUDIENCE
        });
        if (!decoded || typeof decoded !== "object" || typeof decoded.xuid !== "string" || !decoded.xuid || decoded.tokenUse !== "access") {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
}

export function jwtMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return next(unauthorized("Missing Authorization header (Bearer token)"));
    const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1].trim() : "";
    if (!token) return next(unauthorized("Missing Authorization header (Bearer token)"));
    const decoded = verifyJwt(token);
    if (!decoded) return next(unauthorized("Invalid or expired JWT"));
    try {
        assertTokenBinding(decoded, "xboxlive", req.headers["x-xbl-token"] || req.headers["xbl-token"]);
        // Minecraft tokens refresh independently via a PlayFab-session-bound endpoint.
        assertTokenBinding(decoded, "redeem", req.headers["x-redeem-token"]);
        assertTokenBinding(decoded, "playfab", req.body?.playfabToken);
        assertTokenBinding(decoded, "sessionTicket", req.body?.sessionTicket || req.body?.SessionTicket);
    } catch (error) {
        return next(error);
    }
    req.user = decoded;
    next();
}
