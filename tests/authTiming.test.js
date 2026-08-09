import test from "node:test";
import assert from "node:assert/strict";

import {buildAuthCallbackResponse, buildAuthTiming} from "../src/utils/authResponse.js";

test("auth timing schedules refresh before the earliest upstream expiration", () => {
    const now = Date.parse("2026-08-07T10:00:00Z");
    const timing = buildAuthTiming({
        msExpiresIn: 3600,
        xsts: {
            xbox: {NotAfter: "2026-08-07T12:00:00Z"},
            redeem: {NotAfter: "2026-08-07T13:00:00Z"},
            playfab: {NotAfter: "2026-08-07T14:00:00Z"}
        },
        entityTokenExpiresOn: "2026-08-07T15:00:00Z"
    }, now);

    assert.equal(timing.tokenIssuedAt, now);
    assert.equal(timing.tokenExpiresAt.microsoft, now + 3600_000);
    assert.equal(timing.earliestExpiresAt, now + 3600_000);
    assert.equal(timing.refreshAfter, now + 3000_000);
});

test("auth callback exposes timing metadata consumed by clients", () => {
    const now = Date.parse("2026-08-07T10:00:00Z");
    const response = buildAuthCallbackResponse({
        jwtToken: "jwt",
        msExpiresIn: 3600,
        xsts: {xbox: {NotAfter: "2026-08-07T12:00:00Z"}}
    }, now);

    assert.equal(response.tokenIssuedAt, now);
    assert.equal(response.earliestExpiresAt, now + 3600_000);
    assert.equal(response.refreshAfter, now + 3000_000);
});
