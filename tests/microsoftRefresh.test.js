import test from "node:test";
import assert from "node:assert/strict";

import {
    buildRefreshTokenRequest,
    getRefreshClientSecretForFlow,
    refreshMsToken
} from "../src/services/microsoft.service.js";
import {env} from "../src/config/env.js";
import {log} from "../src/utils/logger.js";

const MODERN_CLIENT_ID = "11111111-2222-3333-4444-555555555555";

test("modern confidential refresh authenticates the Microsoft client", () => {
    const request = buildRefreshTokenRequest(
        MODERN_CLIENT_ID,
        "refresh-token",
        "oauth-client-secret"
    );

    assert.equal(request.body.get("client_id"), MODERN_CLIENT_ID);
    assert.equal(request.body.get("grant_type"), "refresh_token");
    assert.equal(request.body.get("refresh_token"), "refresh-token");
    assert.equal(request.body.get("client_secret"), "oauth-client-secret");
});

test("public and legacy refresh requests do not invent a client secret", () => {
    const publicModern = buildRefreshTokenRequest(MODERN_CLIENT_ID, "refresh-token", null);
    const legacy = buildRefreshTokenRequest("legacy-client-id", "refresh-token", "must-not-leak");

    assert.equal(publicModern.body.has("client_secret"), false);
    assert.equal(legacy.body.has("client_secret"), false);
});

test("refresh flow provenance keeps device grants public and browser grants confidential", () => {
    assert.equal(getRefreshClientSecretForFlow("device", "configured-secret"), null);
    assert.equal(getRefreshClientSecretForFlow("browser", "configured-secret"), "configured-secret");
});

test("refreshMsToken sends the configured secret in the form body", async () => {
    let captured;
    const httpClient = {
        async post(url, body, options) {
            captured = {url, body: new URLSearchParams(body), options};
            return {data: {access_token: "fresh-access-token"}};
        }
    };

    const result = await refreshMsToken(
        MODERN_CLIENT_ID,
        "refresh-token",
        httpClient,
        "oauth-client-secret"
    );

    assert.equal(result.access_token, "fresh-access-token");
    assert.equal(captured.body.get("client_secret"), "oauth-client-secret");
    assert.equal(captured.options.headers["content-type"], "application/x-www-form-urlencoded");
    assert.equal(captured.options.maxRedirects, 0);
});

test("refreshMsToken uses the server environment secret when the route omits an override", async (t) => {
    const originalSecret = env.MICROSOFT_OAUTH_CLIENT_SECRET;
    t.after(() => {
        env.MICROSOFT_OAUTH_CLIENT_SECRET = originalSecret;
    });
    env.MICROSOFT_OAUTH_CLIENT_SECRET = "environment-client-secret";

    let form;
    const httpClient = {
        async post(_url, body) {
            form = new URLSearchParams(body);
            return {data: {access_token: "fresh-access-token"}};
        }
    };

    await refreshMsToken(MODERN_CLIENT_ID, "refresh-token", httpClient);
    assert.equal(form.get("client_secret"), "environment-client-secret");
});

test("invalid_client is reported as server configuration without logging credentials", async (t) => {
    const originalWarn = log.warn;
    const warnings = [];
    t.after(() => {
        log.warn = originalWarn;
    });
    log.warn = (...values) => warnings.push(values);

    const httpClient = {
        async post() {
            const error = new Error("rejected");
            error.response = {data: {
                error: "invalid_client",
                error_description: "must-not-log wrong-secret refresh-token"
            }};
            throw error;
        }
    };

    await assert.rejects(
        refreshMsToken(MODERN_CLIENT_ID, "refresh-token", httpClient, "wrong-secret"),
        error => error.status === 502 && error.code === "MICROSOFT_CLIENT_AUTH_FAILED"
    );
    const logged = JSON.stringify(warnings);
    assert.match(logged, /invalid_client/);
    assert.doesNotMatch(logged, /wrong-secret|refresh-token|error_description/);
});

test("invalid_grant remains an expired or revoked user credential", async (t) => {
    const originalWarn = log.warn;
    t.after(() => {
        log.warn = originalWarn;
    });
    log.warn = () => {};
    const httpClient = {
        async post() {
            const error = new Error("rejected");
            error.response = {data: {error: "invalid_grant"}};
            throw error;
        }
    };

    await assert.rejects(
        refreshMsToken(MODERN_CLIENT_ID, "refresh-token", httpClient, "oauth-client-secret"),
        error => error.status === 401 && error.code === "MICROSOFT_REFRESH_TOKEN_INVALID"
    );
});
