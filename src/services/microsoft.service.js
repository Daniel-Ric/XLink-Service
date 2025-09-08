import { env } from "../config/env.js";
import { badRequest, internal } from "../utils/httpError.js";
import { createHttp } from "../utils/http.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);

const DEVICE_CODE_URL = "https://login.live.com/oauth20_connect.srf";
const TOKEN_URL = "https://login.live.com/oauth20_token.srf";
const SCOPE = "service::user.auth.xboxlive.com::MBI_SSL";

export async function requestDeviceCode(clientId) {
    try {
        const body = new URLSearchParams({ client_id: clientId, scope: SCOPE, response_type: "device_code" });
        const { data } = await http.post(DEVICE_CODE_URL, body.toString(), { headers: { "content-type": "application/x-www-form-urlencoded" } });
        return data;
    } catch (err) {
        throw internal("Failed to request device code", err.response?.data || err.message);
    }
}

export async function getTokenFromDeviceCode(clientId, deviceCode) {
    if (!deviceCode) throw badRequest("device_code is required");
    try {
        const body = new URLSearchParams({ client_id: clientId, grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: deviceCode });
        const { data } = await http.post(TOKEN_URL, body.toString(), { headers: { "content-type": "application/x-www-form-urlencoded" } });
        return data;
    } catch (err) {
        const payload = err.response?.data;
        if (payload?.error === "authorization_pending") {
            const e = badRequest("Authorization pending");
            e.details = payload.error_description;
            throw e;
        }
        throw internal("Failed to exchange device_code", payload || err.message);
    }
}
