import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-1234567890";
process.env.CLIENT_ID = process.env.CLIENT_ID || "0000000048183522";

const {
    buildAuthorizationCodeTokenRequest,
    buildBrowserAuthorizationUrl,
    buildDeviceCodeRequest,
    buildDeviceTokenRequest,
    buildRefreshTokenRequest,
    createPkcePair,
    exchangeAuthorizationCode,
    getMicrosoftOAuthConfig,
    getTokenFromDeviceCode,
    isModernMicrosoftClientId,
    refreshMsToken,
    requestDeviceCode
} = await import("../src/services/microsoft.service.js");
const {
    buildFrontendResultUrl,
    consumeMicrosoftCallback,
    OAuthSessionStore
} = await import("../src/services/oauthSession.service.js");
const {exchangeMicrosoftTokenBundle} = await import("../src/services/auth.service.js");

const LEGACY_CLIENT_ID = "0000000048183522";
const MODERN_CLIENT_ID = "3a6cd51c-9323-4ee2-be08-1f0d96aba816";
const LEGACY_GUID_CLIENT_ID = "b36b1432-1a1c-4c82-9b76-24de1cab42f2";
const REDIRECT_URI = "https://api.example.com/auth/browser/callback";

test("client ID format selects legacy and modern Microsoft endpoints and scopes", () => {
    assert.equal(isModernMicrosoftClientId(LEGACY_CLIENT_ID), false);
    assert.equal(isModernMicrosoftClientId(MODERN_CLIENT_ID), true);
    assert.deepEqual(getMicrosoftOAuthConfig(LEGACY_CLIENT_ID), {
        type: "legacy",
        deviceCodeUrl: "https://login.live.com/oauth20_connect.srf",
        authorizeUrl: null,
        tokenUrl: "https://login.live.com/oauth20_token.srf",
        scope: "service::user.auth.xboxlive.com::MBI_SSL"
    });
    assert.deepEqual(getMicrosoftOAuthConfig(MODERN_CLIENT_ID), {
        type: "modern",
        deviceCodeUrl: "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode",
        authorizeUrl: "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        scope: "XboxLive.signin XboxLive.offline_access"
    });
});

test("legacy device request includes response_type and modern request omits it", () => {
    const legacy = buildDeviceCodeRequest(LEGACY_CLIENT_ID);
    const modern = buildDeviceCodeRequest(MODERN_CLIENT_ID);
    assert.equal(legacy.body.get("scope"), "service::user.auth.xboxlive.com::MBI_SSL");
    assert.equal(legacy.body.get("response_type"), "device_code");
    assert.equal(modern.body.get("scope"), "XboxLive.signin XboxLive.offline_access");
    assert.equal(modern.body.has("response_type"), false);
});

test("explicit auth mode overrides client ID format without changing auto detection", () => {
    assert.equal(getMicrosoftOAuthConfig(LEGACY_GUID_CLIENT_ID).type, "modern");
    assert.equal(getMicrosoftOAuthConfig(LEGACY_GUID_CLIENT_ID, "legacy").type, "legacy");
    assert.equal(getMicrosoftOAuthConfig(LEGACY_CLIENT_ID, "modern").type, "modern");
});

test("device-code exchange uses the matching endpoint and standard grant for both flows", () => {
    for (const clientId of [LEGACY_CLIENT_ID, MODERN_CLIENT_ID]) {
        const request = buildDeviceTokenRequest(clientId, "device-code");
        assert.equal(request.url, getMicrosoftOAuthConfig(clientId).tokenUrl);
        assert.equal(request.body.get("client_id"), clientId);
        assert.equal(request.body.get("device_code"), "device-code");
        assert.equal(request.body.get("grant_type"), "urn:ietf:params:oauth:grant-type:device_code");
    }
});

test("refresh uses matching endpoints and scopes for both client ID formats", () => {
    for (const clientId of [LEGACY_CLIENT_ID, MODERN_CLIENT_ID]) {
        const request = buildRefreshTokenRequest(clientId, "refresh-token");
        const config = getMicrosoftOAuthConfig(clientId);
        assert.equal(request.url, config.tokenUrl);
        assert.equal(request.body.get("scope"), config.scope);
        assert.equal(request.body.get("grant_type"), "refresh_token");
        assert.equal(request.body.get("refresh_token"), "refresh-token");
    }
});

test("device-code and refresh HTTP calls use the selected request shape", async () => {
    const calls = [];
    const httpClient = {
        async post(url, body) {
            calls.push({url, body: new URLSearchParams(body)});
            return {data: {access_token: "access", refresh_token: "refresh"}};
        }
    };
    await requestDeviceCode(LEGACY_CLIENT_ID, httpClient);
    await requestDeviceCode(MODERN_CLIENT_ID, httpClient);
    await getTokenFromDeviceCode(MODERN_CLIENT_ID, "device", httpClient);
    await refreshMsToken(LEGACY_CLIENT_ID, "refresh", httpClient);
    assert.equal(calls[0].url, "https://login.live.com/oauth20_connect.srf");
    assert.equal(calls[0].body.get("response_type"), "device_code");
    assert.equal(calls[1].url, "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode");
    assert.equal(calls[1].body.has("response_type"), false);
    assert.equal(calls[2].body.get("grant_type"), "urn:ietf:params:oauth:grant-type:device_code");
    assert.equal(calls[3].body.get("scope"), "service::user.auth.xboxlive.com::MBI_SSL");
});

test("browser authorization URL contains the Entra authorization-code and PKCE parameters", () => {
    const {verifier, challenge} = createPkcePair();
    assert.ok(verifier.length >= 43);
    assert.equal(
        crypto.createHash("sha256").update(verifier).digest("base64url"),
        challenge
    );
    const url = new URL(buildBrowserAuthorizationUrl(
        MODERN_CLIENT_ID,
        REDIRECT_URI,
        "secure-state",
        challenge
    ));
    assert.equal(url.origin + url.pathname, "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize");
    assert.equal(url.searchParams.get("client_id"), MODERN_CLIENT_ID);
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("response_mode"), "query");
    assert.equal(url.searchParams.get("redirect_uri"), REDIRECT_URI);
    assert.equal(url.searchParams.get("scope"), "XboxLive.signin XboxLive.offline_access");
    assert.equal(url.searchParams.get("state"), "secure-state");
    assert.equal(url.searchParams.get("code_challenge"), challenge);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.throws(
        () => buildBrowserAuthorizationUrl(LEGACY_CLIENT_ID, REDIRECT_URI, "state", challenge),
        {message: "Browser login requires a Microsoft Entra GUID client ID in modern auth mode"}
    );
});

test("authorization state is random, short-lived, single-use and keeps PKCE verifier server-side", () => {
    let now = 1000;
    const store = new OAuthSessionStore(60000, () => now);
    const first = store.createAuthorization();
    const second = store.createAuthorization();
    assert.notEqual(first.state, second.state);
    assert.notEqual(first.codeChallenge, second.codeChallenge);
    assert.equal(Object.hasOwn(first, "verifier"), false);
    const consumed = consumeMicrosoftCallback({state: first.state, code: "auth-code"}, store);
    assert.equal(consumed.code, "auth-code");
    assert.equal(
        crypto.createHash("sha256").update(consumed.codeVerifier).digest("base64url"),
        first.codeChallenge
    );
    assert.throws(
        () => consumeMicrosoftCallback({state: first.state, code: "auth-code"}, store),
        {message: "Invalid or expired OAuth state"}
    );
    now += 60001;
    assert.throws(
        () => consumeMicrosoftCallback({state: second.state, code: "auth-code"}, store),
        {message: "Invalid or expired OAuth state"}
    );
});

test("callback rejects missing, wrong, missing-code and Microsoft-denied requests safely", () => {
    const store = new OAuthSessionStore();
    assert.throws(() => consumeMicrosoftCallback({}, store), {message: "Missing OAuth state"});
    assert.throws(
        () => consumeMicrosoftCallback({state: "wrong", code: "code"}, store),
        {message: "Invalid or expired OAuth state"}
    );
    const missingCode = store.createAuthorization();
    assert.throws(
        () => consumeMicrosoftCallback({state: missingCode.state}, store),
        {message: "Missing Microsoft authorization code"}
    );
    const denied = store.createAuthorization();
    assert.throws(
        () => consumeMicrosoftCallback({
            state: denied.state,
            error: "access_denied",
            error_description: "description must not be reflected"
        }, store),
        {message: "Microsoft sign-in was denied"}
    );
    assert.throws(
        () => consumeMicrosoftCallback({state: denied.state, code: "code"}, store),
        {message: "Invalid or expired OAuth state"}
    );
});

test("authorization-code exchange sends PKCE, redirect URI, scope and server secret", async () => {
    const built = buildAuthorizationCodeTokenRequest(
        MODERN_CLIENT_ID,
        "authorization-code",
        REDIRECT_URI,
        "code-verifier",
        "server-secret"
    );
    assert.equal(built.url, "https://login.microsoftonline.com/consumers/oauth2/v2.0/token");
    assert.equal(built.body.get("grant_type"), "authorization_code");
    assert.equal(built.body.get("code"), "authorization-code");
    assert.equal(built.body.get("redirect_uri"), REDIRECT_URI);
    assert.equal(built.body.get("code_verifier"), "code-verifier");
    assert.equal(built.body.get("client_secret"), "server-secret");
    assert.equal(built.body.get("scope"), "XboxLive.signin XboxLive.offline_access");

    let sent;
    const result = await exchangeAuthorizationCode({
        clientId: MODERN_CLIENT_ID,
        code: "authorization-code",
        redirectUri: REDIRECT_URI,
        codeVerifier: "code-verifier",
        clientSecret: "server-secret"
    }, {
        async post(url, body) {
            sent = {url, body: new URLSearchParams(body)};
            return {data: {access_token: "access-token", refresh_token: "refresh-token"}};
        }
    });
    assert.equal(sent.url, built.url);
    assert.equal(sent.body.get("code_verifier"), "code-verifier");
    assert.equal(result.access_token, "access-token");
});

test("frontend handoff is fixed, contains only a one-time code and prevents open redirects", () => {
    const store = new OAuthSessionStore();
    const tokenBundle = {msAccessToken: "access-token", msRefreshToken: "refresh-token"};
    const resultCode = store.createResult(tokenBundle);
    const redirect = new URL(buildFrontendResultUrl("https://app.example.com/auth/callback", resultCode));
    assert.equal(redirect.origin + redirect.pathname, "https://app.example.com/auth/callback");
    assert.deepEqual([...redirect.searchParams.keys()], ["code"]);
    assert.equal(redirect.href.includes("access-token"), false);
    assert.equal(redirect.href.includes("refresh-token"), false);
    assert.deepEqual(store.consumeResult(resultCode), tokenBundle);
    assert.throws(
        () => store.consumeResult(resultCode),
        {message: "Invalid or expired browser result code"}
    );
});

test("all Microsoft login methods reuse the same Xbox, XSTS, PlayFab and Minecraft bundle pipeline", async () => {
    const calls = [];
    const dependencies = {
        async getXBLToken(ticket) {
            calls.push(["xbl", ticket]);
            return "xbl-token";
        },
        async getXSTSToken(_token, relyingParty) {
            calls.push(["xsts", relyingParty]);
            const suffix = relyingParty.includes("b980") ? "redeem" : relyingParty.includes("playfabapi.com") ? "playfab" : "xbox";
            return {
                Token: `${suffix}-xsts`,
                DisplayClaims: suffix === "xbox" ? {xui: [{xid: "1", uhs: "2", gtg: "Player"}]} : undefined
            };
        },
        async loginWithXbox(token, titleId) {
            calls.push(["playfab", token, titleId]);
            return {SessionTicket: "session-ticket", PlayFabId: "playfab-id"};
        },
        async getMCToken(ticket) {
            calls.push(["minecraft", ticket]);
            return "MCToken minecraft";
        },
        async getEntityToken(_ticket, entity) {
            calls.push(["entity", entity?.Type || "title_player_account"]);
            return {
                EntityToken: entity ? "master-entity-token" : "entity-token",
                TokenExpiration: entity ? "master-expiry" : "expiry"
            };
        },
        signJwt(payload) {
            calls.push(["jwt", payload]);
            return "api-jwt";
        }
    };
    const modernResult = await exchangeMicrosoftTokenBundle({
        access_token: "modern-access",
        refresh_token: "modern-refresh",
        expires_in: 3600
    }, MODERN_CLIENT_ID, "20ca2", dependencies);
    assert.deepEqual(calls[0], ["xbl", "d=modern-access"]);
    assert.equal(modernResult.jwt, "api-jwt");
    assert.equal(modernResult.msRefreshToken, "modern-refresh");
    assert.equal(modernResult.xboxliveToken, "XBL3.0 x=2;xbox-xsts");
    assert.equal(modernResult.playfabToken, "XBL3.0 x=2;playfab-xsts");
    assert.equal(modernResult.redeemToken, "XBL3.0 x=2;redeem-xsts");
    assert.equal(modernResult.mcToken, "MCToken minecraft");
    assert.equal(modernResult.entityTokenMaster, "master-entity-token");

    calls.length = 0;
    await exchangeMicrosoftTokenBundle({
        access_token: "legacy-access",
        refresh_token: "legacy-refresh",
        expires_in: 3600
    }, LEGACY_CLIENT_ID, "20ca2", dependencies);
    assert.deepEqual(calls[0], ["xbl", "legacy-access"]);
});
