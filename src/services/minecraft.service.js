import {randomUUID} from "crypto";
import {env} from "../config/env.js";
import {internal} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";

const AUTH_BASE = "https://authorization.franchise.minecraft-services.net/api/v1.0/session/start";
const ENTITLEMENTS_BASE = "https://entitlements.mktpl.minecraft-services.net/api/v1.0/player/inventory";

const http = createHttp(env.HTTP_TIMEOUT_MS);

export async function getMCToken(sessionTicket) {
    try {
        if (!sessionTicket || typeof sessionTicket !== "string") {
            throw internal("Failed to get Minecraft token", "SessionTicket missing/invalid");
        }
        const gameVersion = env.MC_GAME_VERSION;
        const platform = env.MC_PLATFORM;
        const playFabTitleId = env.PLAYFAB_TITLE_ID || "20ca2";
        const payload = {
            user: {language: "en", languageCode: "en-US", regionCode: "US", token: sessionTicket, tokentype: "playfab"},
            device: {
                applicationType: "MinecraftPE",
                memory: Math.floor(Math.random() * 1000000000000) + 1,
                id: randomUUID(),
                gameVersion,
                platform,
                playFabTitleId,
                storePlatform: "uwp.store",
                treatmentOverrides: null,
                type: platform
            }
        };
        const res = await http.post(AUTH_BASE, payload, {
            headers: {
                Accept: "application/json",
                charset: "utf-8",
                "content-type": "application/json",
                "user-agent": "MCPE/UWP"
            }
        });
        if (res.data?.result?.authorizationHeader) {
            return res.data.result.authorizationHeader;
        }
        const isString = typeof res.data === "string";
        throw internal("Failed to get Minecraft token", {
            status: 500,
            json: !isString ? res.data : undefined,
            htmlSnippet: isString ? res.data.slice(0, 800) : undefined
        });
    } catch (err) {
        const detail = err.details || err.response?.data || err.message || err;
        throw internal("Failed to get Minecraft token", detail);
    }
}

export async function getMCInventory(mcToken, includeReceipt = false) {
    if (!mcToken) throw internal("Failed to get MC inventory", "mcToken missing");
    try {
        const url = `${ENTITLEMENTS_BASE}?includeReceipt=${includeReceipt ? "true" : "false"}`;
        const {data} = await http.get(url, {headers: {Authorization: mcToken, Accept: "application/json"}});
        const entitlements = data?.result?.inventory?.entitlements || [];
        return entitlements;
    } catch (err) {
        throw internal("Failed to get MC inventory", err.response?.data || err.message);
    }
}
