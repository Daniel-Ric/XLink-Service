import crypto from "node:crypto";
import {env} from "../config/env.js";
import {badRequest} from "../utils/httpError.js";
import {createPkcePair} from "./microsoft.service.js";

function digest(value) {
    return crypto.createHash("sha256").update(String(value || "")).digest("base64url");
}

function randomValue() {
    return crypto.randomBytes(32).toString("base64url");
}

export class OAuthSessionStore {
    constructor(ttlMs = 300000, clock = () => Date.now()) {
        this.ttlMs = ttlMs;
        this.clock = clock;
        this.authorizationStates = new Map();
        this.results = new Map();
    }

    prune() {
        const now = this.clock();
        for (const [key, value] of this.authorizationStates) {
            if (value.expiresAt <= now) this.authorizationStates.delete(key);
        }
        for (const [key, value] of this.results) {
            if (value.expiresAt <= now) this.results.delete(key);
        }
    }

    createAuthorization() {
        this.prune();
        const state = randomValue();
        const {verifier, challenge} = createPkcePair();
        this.authorizationStates.set(digest(state), {
            verifier,
            expiresAt: this.clock() + this.ttlMs
        });
        return {state, codeChallenge: challenge};
    }

    consumeAuthorization(state) {
        if (!state) throw badRequest("Missing OAuth state");
        const key = digest(state);
        const session = this.authorizationStates.get(key);
        this.authorizationStates.delete(key);
        if (!session || session.expiresAt <= this.clock()) {
            throw badRequest("Invalid or expired OAuth state");
        }
        return session;
    }

    createResult(data) {
        this.prune();
        const code = randomValue();
        this.results.set(digest(code), {
            data,
            expiresAt: this.clock() + this.ttlMs
        });
        return code;
    }

    consumeResult(code) {
        if (!code) throw badRequest("Browser result code is required");
        const key = digest(code);
        const result = this.results.get(key);
        this.results.delete(key);
        if (!result || result.expiresAt <= this.clock()) {
            throw badRequest("Invalid or expired browser result code");
        }
        return result.data;
    }
}

export function consumeMicrosoftCallback(query, store) {
    const session = store.consumeAuthorization(query?.state);
    if (query?.error) {
        const reason = query.error === "access_denied" ? "Microsoft sign-in was denied" : "Microsoft sign-in failed";
        throw badRequest(reason);
    }
    if (!query?.code) throw badRequest("Missing Microsoft authorization code");
    return {code: query.code, codeVerifier: session.verifier};
}

export function buildFrontendResultUrl(frontendRedirectUri, resultCode) {
    const url = new URL(frontendRedirectUri);
    url.searchParams.set("code", resultCode);
    return url.toString();
}

export const oauthSessionStore = new OAuthSessionStore(Number(env.MICROSOFT_OAUTH_TTL_MS) || 300000);
const cleanupInterval = setInterval(
    () => oauthSessionStore.prune(),
    Math.min(oauthSessionStore.ttlMs, 60000)
);
cleanupInterval.unref?.();
