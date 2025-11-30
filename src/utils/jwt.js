import jwt from "jsonwebtoken";
import {env} from "../config/env.js";
import {forbidden, unauthorized} from "./httpError.js";

export function signJwt(payload, expiresIn) {
    const finalExpiresIn = expiresIn || env.JWT_EXPIRES_IN || "1h";
    return jwt.sign(payload, env.JWT_SECRET, {expiresIn: finalExpiresIn});
}

export function verifyJwt(token) {
    try {
        return jwt.verify(token, env.JWT_SECRET);
    } catch {
        return null;
    }
}

export function jwtMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return next(unauthorized("Missing Authorization header (Bearer token)"));
    const [, token] = authHeader.split(" ");
    const decoded = verifyJwt(token);
    if (!decoded) return next(forbidden("Invalid or expired JWT"));
    req.user = decoded;
    next();
}
