import test, {after} from "node:test";
import assert from "node:assert/strict";
import axios from "axios";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "minecraft-route-test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.JWT_ISSUER = "xlink-route-test";
process.env.JWT_AUDIENCE = "xlink-route-test-api";
process.env.CLIENT_ID = "minecraft-route-test-client";
process.env.PLAYFAB_TITLE_ID = "20ca2";

const PLAYFAB_URL = "https://20ca2.playfabapi.com/Client/LoginWithXbox";
const MINECRAFT_URL = "https://authorization.franchise.minecraft-services.net/api/v1.0/session/start";
const PLAYFAB_TOKEN = "XBL3.0 x=test-uhs;playfab-token";
const NEW_SESSION_TICKET = "new-session-ticket";
const NEW_MC_TOKEN = "MCToken new-minecraft-token";

const originalAdapter = axios.defaults.adapter;
const upstreamCalls = [];
let playFabLogin = null;
let playFabEnvelope = null;
let minecraftEnvelope = null;

function axiosResponse(config, data) {
    return {
        status: 200,
        statusText: "OK",
        headers: {"content-type": "application/json"},
        config,
        request: {},
        data
    };
}

axios.defaults.adapter = async config => {
    const url = String(config.url);
    upstreamCalls.push(url);
    if (url === PLAYFAB_URL) {
        return axiosResponse(config, playFabEnvelope);
    }
    if (url === MINECRAFT_URL) {
        return axiosResponse(config, minecraftEnvelope);
    }
    throw new Error(`Unexpected upstream request: ${url}`);
};

const [
    {default: express},
    {default: minecraftRoutes},
    {errorHandler},
    {signJwt, verifyJwt},
    {buildTokenBindings, tokenFingerprint}
] = await Promise.all([
    import("express"),
    import("../src/routes/minecraft.routes.js"),
    import("../src/middleware/error.js"),
    import("../src/utils/jwt.js"),
    import("../src/utils/tokenBinding.js")
]);

const originalBindings = buildTokenBindings({
    xboxlive: "original-xbox-token",
    playfab: PLAYFAB_TOKEN,
    redeem: "original-redeem-token",
    sessionTicket: "old-session-ticket",
    minecraft: "MCToken old-minecraft-token"
});
const currentJwt = signJwt({
    xuid: "test-xuid",
    gamertag: "TestPlayer",
    uhs: "test-uhs",
    tokenBindings: originalBindings
});

const app = express();
app.use(express.json());
app.use("/minecraft", minecraftRoutes);
app.use(errorHandler);

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
});
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

after(async () => {
    axios.defaults.adapter = originalAdapter;
    if (server.listening) {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
            server.closeAllConnections?.();
        });
    }
});

function configureUpstreams({
    playFab = {SessionTicket: NEW_SESSION_TICKET, PlayFabId: "test-playfab-id"},
    playFabResponse = {data: playFab},
    minecraft = {result: {authorizationHeader: NEW_MC_TOKEN}}
} = {}) {
    playFabLogin = playFab;
    playFabEnvelope = playFabResponse;
    minecraftEnvelope = minecraft;
    upstreamCalls.length = 0;
}

async function refreshMinecraftTokens() {
    const response = await fetch(`${baseUrl}/minecraft/token/refresh`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${currentJwt}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({playfabToken: PLAYFAB_TOKEN})
    });
    return {response, body: await response.json()};
}

test("minecraft token refresh returns a replacement JWT with rotated bindings and no-store headers", async () => {
    configureUpstreams();

    const {response, body} = await refreshMinecraftTokens();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("pragma"), "no-cache");
    assert.equal(body.sessionTicket, NEW_SESSION_TICKET);
    assert.equal(body.playFabId, "test-playfab-id");
    assert.equal(body.mcToken, NEW_MC_TOKEN);
    assert.equal(body.expiresIn, "1h");
    assert.equal(typeof body.jwt, "string");

    const decoded = verifyJwt(body.jwt);
    assert.ok(decoded);
    assert.equal(decoded.xuid, "test-xuid");
    assert.equal(decoded.gamertag, "TestPlayer");
    assert.equal(decoded.uhs, "test-uhs");
    assert.equal(decoded.tokenBindings.xboxlive, originalBindings.xboxlive);
    assert.equal(decoded.tokenBindings.playfab, originalBindings.playfab);
    assert.equal(decoded.tokenBindings.redeem, originalBindings.redeem);
    assert.equal(decoded.tokenBindings.sessionTicket, tokenFingerprint(NEW_SESSION_TICKET));
    assert.equal(decoded.tokenBindings.minecraft, tokenFingerprint(NEW_MC_TOKEN));
    assert.notEqual(decoded.tokenBindings.sessionTicket, originalBindings.sessionTicket);
    assert.notEqual(decoded.tokenBindings.minecraft, originalBindings.minecraft);
    assert.deepEqual(upstreamCalls, [PLAYFAB_URL, MINECRAFT_URL]);
});

test("minecraft token refresh rejects a malformed PlayFab success envelope without issuing a JWT", async () => {
    configureUpstreams({playFab: null});

    const {response, body} = await refreshMinecraftTokens();

    assert.equal(response.status, 502);
    assert.equal(body.error?.code, "BAD_GATEWAY");
    assert.equal(body.error?.message, "PlayFab returned an invalid login response");
    assert.equal(Object.hasOwn(body, "jwt"), false);
    assert.deepEqual(upstreamCalls, [PLAYFAB_URL]);
});

test("minecraft token refresh rejects a malformed Minecraft success envelope without issuing a JWT", async () => {
    configureUpstreams({minecraft: {result: {authorizationHeader: {token: NEW_MC_TOKEN}}}});

    const {response, body} = await refreshMinecraftTokens();

    assert.equal(response.status, 502);
    assert.equal(body.error?.code, "BAD_GATEWAY");
    assert.equal(body.error?.message, "Failed to get Minecraft token");
    assert.equal(Object.hasOwn(body, "jwt"), false);
    assert.deepEqual(upstreamCalls, [PLAYFAB_URL, MINECRAFT_URL]);
});

test("minecraft token refresh maps top-level empty upstream successes to bad gateway", async () => {
    configureUpstreams({playFabResponse: null});
    let result = await refreshMinecraftTokens();
    assert.equal(result.response.status, 502);
    assert.equal(result.body.error?.code, "BAD_GATEWAY");
    assert.equal(Object.hasOwn(result.body, "jwt"), false);
    assert.deepEqual(upstreamCalls, [PLAYFAB_URL]);

    configureUpstreams({minecraft: null});
    result = await refreshMinecraftTokens();
    assert.equal(result.response.status, 502);
    assert.equal(result.body.error?.code, "BAD_GATEWAY");
    assert.equal(Object.hasOwn(result.body, "jwt"), false);
    assert.deepEqual(upstreamCalls, [PLAYFAB_URL, MINECRAFT_URL]);
});
