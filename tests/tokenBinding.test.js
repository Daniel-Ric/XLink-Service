import test from "node:test";
import assert from "node:assert/strict";

import {
    buildTokenBindings,
    mergeTokenBindings,
    tokenFingerprint
} from "../src/utils/tokenBinding.js";

test("rotating a PlayFab session preserves unrelated bindings and replaces session credentials", () => {
    const original = buildTokenBindings({
        xboxlive: "xbox-token",
        playfab: "playfab-token",
        sessionTicket: "old-session",
        minecraft: "old-minecraft-token"
    });

    const rotated = mergeTokenBindings(original, {
        sessionTicket: "new-session",
        minecraft: "new-minecraft-token"
    });

    assert.equal(rotated.xboxlive, original.xboxlive);
    assert.equal(rotated.playfab, original.playfab);
    assert.equal(rotated.sessionTicket, tokenFingerprint("new-session"));
    assert.equal(rotated.minecraft, tokenFingerprint("new-minecraft-token"));
    assert.notEqual(rotated.sessionTicket, original.sessionTicket);
});
