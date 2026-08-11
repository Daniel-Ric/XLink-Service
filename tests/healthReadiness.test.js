import test from "node:test";
import assert from "node:assert/strict";

import {getReadinessStatus} from "../src/routes/health.routes.js";

test("browser OAuth configuration is not ready without its confidential client secret", () => {
    assert.deepEqual(getReadinessStatus({
        CLIENT_ID: "11111111-2222-3333-4444-555555555555",
        MICROSOFT_AUTH_MODE: "modern",
        MICROSOFT_OAUTH_REDIRECT_URI: "https://example.test/auth/callback"
    }), {
        ready: false,
        reason: "microsoft_oauth_client_secret_missing"
    });
});

test("device-only or fully configured browser OAuth remains ready", () => {
    assert.deepEqual(getReadinessStatus({}), {ready: true});
    assert.deepEqual(getReadinessStatus({
        CLIENT_ID: "legacy-client-id",
        MICROSOFT_AUTH_MODE: "auto",
        MICROSOFT_OAUTH_REDIRECT_URI: "https://example.test/auth/callback"
    }), {ready: true});
    assert.deepEqual(getReadinessStatus({
        CLIENT_ID: "11111111-2222-3333-4444-555555555555",
        MICROSOFT_AUTH_MODE: "modern",
        MICROSOFT_OAUTH_REDIRECT_URI: "https://example.test/auth/callback",
        MICROSOFT_OAUTH_CLIENT_SECRET: "configured-outside-source-control"
    }), {ready: true});
});
