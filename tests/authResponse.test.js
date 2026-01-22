import test from "node:test";
import assert from "node:assert/strict";

import {buildAuthCallbackResponse} from "../src/utils/authResponse.js";

test("buildAuthCallbackResponse maps callback payload", () => {
    const result = buildAuthCallbackResponse({
        jwtToken: "jwt",
        xuid: "xuid",
        gamertag: "tag",
        uhs: "uhs",
        msAccessToken: "ms-access",
        msRefreshToken: "ms-refresh",
        msExpiresIn: 3600,
        xblToken: "xbl",
        xsts: {xbox: {Token: "xsts"}},
        xboxliveToken: "XBL3.0 x=uhs;xsts",
        playfabToken: "XBL3.0 x=uhs;pf",
        redeemToken: "XBL3.0 x=uhs;redeem",
        mcToken: "MCToken mc",
        sessionTicket: "ticket",
        playFabId: "pfid",
        entityToken: "entity-token",
        entityTokenExpiresOn: "2025-01-01T00:00:00Z",
        entityTokenMaster: "entity-master",
        entityTokenMasterExpiresOn: "2025-01-01T01:00:00Z"
    });

    assert.deepEqual(result, {
        jwt: "jwt",
        xuid: "xuid",
        gamertag: "tag",
        uhs: "uhs",
        msAccessToken: "ms-access",
        msRefreshToken: "ms-refresh",
        msExpiresIn: 3600,
        xblToken: "xbl",
        xsts: {xbox: {Token: "xsts"}},
        xboxliveToken: "XBL3.0 x=uhs;xsts",
        playfabToken: "XBL3.0 x=uhs;pf",
        redeemToken: "XBL3.0 x=uhs;redeem",
        mcToken: "MCToken mc",
        sessionTicket: "ticket",
        playFabId: "pfid",
        entityToken: "entity-token",
        entityTokenExpiresOn: "2025-01-01T00:00:00Z",
        entityTokenMaster: "entity-master",
        entityTokenMasterExpiresOn: "2025-01-01T01:00:00Z"
    });
});
