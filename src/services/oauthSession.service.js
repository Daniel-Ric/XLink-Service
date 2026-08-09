import crypto from "node:crypto";
import {env} from "../config/env.js";
import {badRequest, forbidden, tooManyRequests} from "../utils/httpError.js";
import {createPkcePair} from "./microsoft.service.js";

function digest(value) {
    return crypto.createHash("sha256").update(String(value || "")).digest("base64url");
}

function randomValue() {
    return crypto.randomBytes(32).toString("base64url");
}

export class OAuthSessionStore {
    constructor(ttlMs = 300000, clock = () => Date.now(), maxEntries = 1000) {
        this.ttlMs = ttlMs;
        this.clock = clock;
        this.maxEntries = maxEntries;
        this.authorizationStates = new Map();
        this.results = new Map();
        this.handoffs = new Map();
    }

    assertCapacity(map, label) {
        if (map.size >= this.maxEntries) throw tooManyRequests(`${label} capacity reached`);
    }

    prune() {
        const now = this.clock();
        for (const [key, value] of this.authorizationStates) {
            if (value.expiresAt <= now) this.authorizationStates.delete(key);
        }
        for (const [key, value] of this.results) {
            if (value.expiresAt <= now) this.results.delete(key);
        }
        for (const [key, value] of this.handoffs) {
            if (value.expiresAt <= now) this.handoffs.delete(key);
        }
    }

    createAuthorization(context = {}) {
        this.prune();
        this.assertCapacity(this.authorizationStates, "OAuth authorization state");
        const state = randomValue();
        const {verifier, challenge} = createPkcePair();
        this.authorizationStates.set(digest(state), {
            verifier,
            context,
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

    createResult(data, source = "direct") {
        this.prune();
        this.assertCapacity(this.results, "OAuth result");
        const code = randomValue();
        this.results.set(digest(code), {
            data,
            source,
            expiresAt: this.clock() + this.ttlMs
        });
        return code;
    }

    consumeResult(code, expectedSource) {
        if (!code) throw badRequest("Browser result code is required");
        const key = digest(code);
        const result = this.results.get(key);
        if (!result || result.expiresAt <= this.clock()) {
            this.results.delete(key);
            throw badRequest("Invalid or expired browser result code");
        }
        if (expectedSource && result.source !== expectedSource) {
            throw badRequest("Browser result code does not match this login source");
        }
        this.results.delete(key);
        return result.data;
    }

    createHandoff(source, context = {}) {
        this.prune();
        this.assertCapacity(this.handoffs, "OAuth browser session");
        const sessionId = randomValue();
        const pollToken = randomValue();
        this.handoffs.set(digest(sessionId), {
            ...context,
            source,
            pollTokenDigest: digest(pollToken),
            status: "pending",
            data: null,
            expiresAt: this.clock() + this.ttlMs
        });
        return {
            sessionId,
            pollToken,
            expiresIn: Math.ceil(this.ttlMs / 1000)
        };
    }

    getHandoff(sessionId, expectedSource) {
        if (!sessionId) throw badRequest("Browser session is required");
        const handoff = this.handoffs.get(digest(sessionId));
        if (!handoff || handoff.expiresAt <= this.clock()) {
            throw badRequest("Invalid or expired browser session");
        }
        if (expectedSource && handoff.source !== expectedSource) {
            throw badRequest("Browser session does not match this login source");
        }
        return handoff;
    }

    completeHandoff(sessionId, data) {
        const handoff = this.getHandoff(sessionId);
        if (handoff.expectedXuid && data?.xuid !== handoff.expectedXuid) {
            this.handoffs.delete(digest(sessionId));
            throw forbidden("Microsoft account does not match the authenticated browser session user");
        }
        handoff.status = "complete";
        handoff.data = data;
        return handoff;
    }

    consumeHandoff(sessionId, pollToken, expectedSource) {
        const key = digest(sessionId);
        const handoff = this.getHandoff(sessionId, expectedSource);
        const actual = Buffer.from(digest(pollToken));
        const expected = Buffer.from(handoff.pollTokenDigest);
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
            throw badRequest("Invalid browser session poll token");
        }
        if (handoff.status !== "complete") return {status: "pending"};
        this.handoffs.delete(key);
        return {status: "complete", data: handoff.data};
    }
}

export function consumeMicrosoftCallback(query, store) {
    const session = store.consumeAuthorization(query?.state);
    if (query?.error) {
        const reason = query.error === "access_denied" ? "Microsoft sign-in was denied" : "Microsoft sign-in failed";
        throw badRequest(reason);
    }
    if (!query?.code) throw badRequest("Missing Microsoft authorization code");
    return {code: query.code, codeVerifier: session.verifier, context: session.context};
}

export function buildFrontendResultUrl(frontendRedirectUri, resultCode) {
    const url = new URL(frontendRedirectUri);
    url.searchParams.set("code", resultCode);
    return url.toString();
}

export function buildFrontendPageUrl(frontendRedirectUri, pathname) {
    const url = new URL(frontendRedirectUri);
    url.pathname = pathname;
    url.search = "";
    url.hash = "";
    return url.toString();
}

export const oauthSessionStore = new OAuthSessionStore(Number(env.MICROSOFT_OAUTH_TTL_MS) || 300000);
const cleanupInterval = setInterval(
    () => oauthSessionStore.prune(),
    Math.min(oauthSessionStore.ttlMs, 60000)
);
cleanupInterval.unref?.();
