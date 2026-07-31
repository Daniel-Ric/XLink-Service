import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-1234567890";
process.env.CLIENT_ID = "3a6cd51c-9323-4ee2-be08-1f0d96aba816";
process.env.MICROSOFT_AUTH_MODE = "auto";
process.env.MICROSOFT_OAUTH_REDIRECT_URI = "https://api.example.com/auth/browser/callback";
process.env.MICROSOFT_OAUTH_FRONTEND_REDIRECT_URI = "https://app.example.com/auth/callback";
process.env.MICROSOFT_OAUTH_CLIENT_SECRET = "test-client-secret";
process.env.SWAGGER_ENABLED = "false";
process.env.LOG_PRETTY = "false";

const {default: app} = await import("../src/app.js");

async function withServer(run) {
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    try {
        await run(`http://127.0.0.1:${server.address().port}`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

test("browser login route redirects to Entra with state, PKCE and no-store headers", async () => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/auth/browser`, {redirect: "manual"});
        assert.equal(response.status, 302);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("pragma"), "no-cache");
        const location = new URL(response.headers.get("location"));
        assert.equal(location.origin + location.pathname, "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize");
        assert.equal(location.searchParams.get("client_id"), process.env.CLIENT_ID);
        assert.equal(location.searchParams.get("redirect_uri"), process.env.MICROSOFT_OAUTH_REDIRECT_URI);
        assert.ok(location.searchParams.get("state"));
        assert.ok(location.searchParams.get("code_challenge"));
        assert.equal(location.searchParams.get("code_challenge_method"), "S256");
    });
});

test("browser result route rejects invalid codes with no-store headers", async () => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/auth/browser/token`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({code: "invalid"})
        });
        assert.equal(response.status, 400);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("pragma"), "no-cache");
        const body = await response.json();
        assert.equal(body.error.message, "Invalid or expired browser result code");
    });
});

test("website browser login is source-aware", async () => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/auth/browser?source=website`, {redirect: "manual"});
        assert.equal(response.status, 302);
        const location = new URL(response.headers.get("location"));
        assert.ok(location.searchParams.get("state"));
        assert.equal(location.searchParams.has("source"), false);
    });
});

test("client browser sessions keep the poll token out of the login URL", async () => {
    await withServer(async baseUrl => {
        const created = await fetch(`${baseUrl}/auth/browser/session`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({successPath: "/auth/client/success"})
        });
        assert.equal(created.status, 201);
        const session = await created.json();
        assert.ok(session.sessionId);
        assert.ok(session.pollToken);

        const login = await fetch(
            `${baseUrl}/auth/browser?source=client&session=${encodeURIComponent(session.sessionId)}`,
            {redirect: "manual"}
        );
        assert.equal(login.status, 302);
        assert.equal(login.headers.get("location").includes(session.pollToken), false);

        const pending = await fetch(`${baseUrl}/auth/browser/session/token`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({sessionId: session.sessionId, pollToken: session.pollToken})
        });
        assert.equal(pending.status, 202);
        assert.deepEqual(await pending.json(), {status: "pending"});
    });
});

test("client browser sessions reject external success URLs", async () => {
    await withServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/auth/browser/session`, {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({successPath: "https://evil.example/success"})
        });
        assert.equal(response.status, 400);
    });
});
