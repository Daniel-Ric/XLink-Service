import crypto from "node:crypto";
import {forbidden} from "./httpError.js";

export function tokenFingerprint(value) {
    if (typeof value !== "string" || !value) return null;
    return crypto.createHash("sha256").update(value).digest("base64url");
}

export function buildTokenBindings(tokens = {}) {
    return Object.fromEntries(Object.entries(tokens)
        .map(([kind, value]) => [kind, tokenFingerprint(value)])
        .filter(([, fingerprint]) => fingerprint));
}

export function mergeTokenBindings(existing = {}, rotatedTokens = {}) {
    return {
        ...(existing && typeof existing === "object" ? existing : {}),
        ...buildTokenBindings(rotatedTokens)
    };
}

export function assertTokenBinding(user, kind, value) {
    if (!value) return;
    const expected = user?.tokenBindings?.[kind];
    const actual = tokenFingerprint(value);
    if (!expected || !actual || expected.length !== actual.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
        throw forbidden(`${kind} token is not bound to the authenticated XLink session`);
    }
}
