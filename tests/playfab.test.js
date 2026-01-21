import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-1234567890";
process.env.CLIENT_ID = process.env.CLIENT_ID || "test-client";

const {resolvePlayFabTitleId} = await import("../src/services/playfab.service.js");

test("resolvePlayFabTitleId uses explicit title id", () => {
    assert.equal(resolvePlayFabTitleId("e9d1"), "e9d1");
});

test("resolvePlayFabTitleId rejects empty title id", () => {
    assert.throws(() => resolvePlayFabTitleId(""), {
        message: "PLAYFAB_TITLE_ID missing. Set it in .env"
    });
});
