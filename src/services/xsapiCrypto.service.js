import crypto from "node:crypto";
import {badRequest} from "../utils/httpError.js";

const WINDOWS_TICK_OFFSET = 116444736000000000n;
const WINDOWS_TICKS_PER_MS = 10000n;

function base64UrlToBuffer(value) {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    return Buffer.from(padded, "base64");
}

function bufferToBase64Url(buffer) {
    return Buffer.from(buffer)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function readBigIntBase64Url(value) {
    if (!value) throw badRequest("Invalid P-256 key");
    return BigInt(`0x${base64UrlToBuffer(value).toString("hex") || "0"}`);
}

function assertP256Jwk(jwk) {
    if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) {
        throw badRequest("proofKeyJwk must be a P-256 EC JWK");
    }
    if (!jwk.d) throw badRequest("proofKeyJwk must include the private key parameter d");
}

function importPrivateKey(proofKeyJwk) {
    assertP256Jwk(proofKeyJwk);
    return crypto.createPrivateKey({key: proofKeyJwk, format: "jwk"});
}

export function generateProofKey() {
    const {privateKey, publicKey} = crypto.generateKeyPairSync("ec", {namedCurve: "prime256v1"});
    const privateJwk = privateKey.export({format: "jwk"});
    const publicJwk = publicKey.export({format: "jwk"});
    return {
        privateJwk: {
            ...privateJwk,
            alg: "ES256",
            use: "sig"
        },
        publicJwk: {
            ...publicJwk,
            alg: "ES256",
            use: "sig"
        }
    };
}

export function publicProofKey(proofKeyJwk) {
    assertP256Jwk(proofKeyJwk);
    return {
        kty: "EC",
        crv: "P-256",
        x: proofKeyJwk.x,
        y: proofKeyJwk.y,
        alg: "ES256",
        use: "sig"
    };
}

export function normalizeProofKey(proofKeyJwk) {
    assertP256Jwk(proofKeyJwk);
    return {
        ...proofKeyJwk,
        alg: proofKeyJwk.alg || "ES256",
        use: proofKeyJwk.use || "sig"
    };
}

export function proofKeyId(proofKeyJwk) {
    if (!proofKeyJwk) return null;
    const publicJwk = publicProofKey(proofKeyJwk);
    return crypto.createHash("sha256").update(JSON.stringify(publicJwk)).digest("hex").slice(0, 16);
}

export function windowsTimestamp(date = new Date()) {
    return BigInt(date.getTime()) * WINDOWS_TICKS_PER_MS + WINDOWS_TICK_OFFSET;
}

export function decodeMaybeProofKey(value) {
    if (!value) return null;
    if (typeof value === "object") return normalizeProofKey(value);
    const raw = String(value).trim();
    if (!raw) return null;
    try {
        return normalizeProofKey(JSON.parse(raw));
    } catch {
        try {
            return normalizeProofKey(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
        } catch {
            throw badRequest("Invalid proof key encoding");
        }
    }
}

export function encodeProofKeyHeader(proofKeyJwk) {
    return Buffer.from(JSON.stringify(normalizeProofKey(proofKeyJwk)), "utf8").toString("base64url");
}

export function signXboxRequest({
    method,
    url,
    authorization = "",
    headers = {},
    body,
    proofKeyJwk,
    policy = {},
    timestamp = new Date()
}) {
    const key = importPrivateKey(proofKeyJwk);
    const requestUrl = new URL(url);
    const version = Number(policy.Version ?? policy.version ?? 1);
    const maxBodyBytes = Number(policy.MaxBodyBytes ?? policy.maxBodyBytes ?? 0);
    const extraHeaders = policy.ExtraHeaders ?? policy.extraHeaders ?? [];
    const bodyBuffer = Buffer.isBuffer(body)
        ? body
        : body == null
            ? Buffer.alloc(0)
            : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));

    const headerLookup = new Map();
    for (const [keyName, value] of Object.entries(headers || {})) {
        headerLookup.set(keyName.toLowerCase(), String(value));
    }
    if (authorization) headerLookup.set("authorization", String(authorization));

    const signedBody = maxBodyBytes > 0 ? bodyBuffer.subarray(0, Math.min(maxBodyBytes, bodyBuffer.length)) : bodyBuffer;
    const fileTime = windowsTimestamp(timestamp);
    const versionBuffer = Buffer.alloc(4);
    versionBuffer.writeUInt32BE(version);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(fileTime);

    const pathAndQuery = `${requestUrl.pathname}${requestUrl.search}`;
    const hash = crypto.createHash("sha256");
    hash.update(versionBuffer);
    hash.update(Buffer.from([0]));
    hash.update(timeBuffer);
    hash.update(Buffer.from([0]));
    hash.update(String(method || "GET").toUpperCase());
    hash.update(Buffer.from([0]));
    hash.update(pathAndQuery);
    hash.update(Buffer.from([0]));
    for (const headerName of ["authorization", ...extraHeaders.map(h => String(h).toLowerCase())]) {
        hash.update(headerLookup.get(headerName) || "");
        hash.update(Buffer.from([0]));
    }
    hash.update(signedBody);
    hash.update(Buffer.from([0]));

    const digest = hash.digest();
    const signature = crypto.sign(null, digest, {
        key,
        dsaEncoding: "ieee-p1363"
    });
    return Buffer.concat([versionBuffer, timeBuffer, signature]).toString("base64");
}

export function jwkThumbprint(proofKeyJwk) {
    const ordered = publicProofKey(proofKeyJwk);
    const canonical = JSON.stringify({
        crv: ordered.crv,
        kty: ordered.kty,
        x: ordered.x,
        y: ordered.y
    });
    return bufferToBase64Url(crypto.createHash("sha256").update(canonical).digest());
}

export function p256PublicPoint(proofKeyJwk) {
    assertP256Jwk(proofKeyJwk);
    return {
        x: readBigIntBase64Url(proofKeyJwk.x),
        y: readBigIntBase64Url(proofKeyJwk.y)
    };
}
