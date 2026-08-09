import axios from "axios";
import http from "node:http";
import https from "node:https";

const httpAgent = new http.Agent({keepAlive: true, maxSockets: 100});
const httpsAgent = new https.Agent({keepAlive: true, maxSockets: 100});

export function validateUpstreamSuccess(response) {
    if (response.status === 204) return response;
    const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
    if (contentType && !contentType.includes("json")) {
        throw new Error(`Upstream returned unexpected content type ${contentType}`);
    }
    const data = response.data;
    if (data == null || typeof data === "string") {
        throw new Error("Upstream returned an empty or non-JSON success body");
    }
    if (!Array.isArray(data) && typeof data !== "object") {
        throw new Error("Upstream returned an invalid success body");
    }
    const apparentError = !Array.isArray(data) && (
        data.error != null || data.errorMessage != null ||
        (typeof data.status === "string" && /^error$/i.test(data.status)) ||
        (typeof data.code === "number" && data.code >= 400)
    );
    if (apparentError) throw new Error("Upstream returned an error envelope with a successful HTTP status");
    return response;
}

export function createHttp(timeoutMs = 15000) {
    const client = axios.create({
        timeout: Number(timeoutMs) || 15000,
        httpAgent,
        httpsAgent,
        proxy: false,
        validateStatus: s => s >= 200 && s < 300,
        maxRedirects: 5
    });
    client.interceptors.response.use(validateUpstreamSuccess);
    return client;
}
