import {randomUUID} from "crypto";

import {env} from "../config/env.js";
import {badRequest, forbidden, internal, unauthorized} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";

const AUTH_BASE = "https://authorization.franchise.minecraft-services.net/api/v1.0/session/start";
const ENTITLEMENTS_BASE = "https://entitlements.mktpl.minecraft-services.net/api/v1.0";
const STORE_BASE = "https://store.mktpl.minecraft-services.net/api/v1.0";
const MESSAGING_BASE = "https://messaging.mktpl.minecraft-services.net/api/v1.0";

const http = createHttp(env.HTTP_TIMEOUT_MS);

export async function getMCToken(sessionTicket) {
    try {
        if (!sessionTicket || typeof sessionTicket !== "string") {
            throw badRequest("SessionTicket missing/invalid");
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
        const status = err.response?.status;
        const detail = err.details || err.response?.data || err.message || err;
        if (status === 401) {
            throw unauthorized("Failed to get Minecraft token", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get Minecraft token", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw unauthorized("Failed to get Minecraft token", detail);
        }
        throw internal("Failed to get Minecraft token", detail);
    }
}

export async function getMCInventory(mcToken, includeReceipt = false) {
    if (!mcToken) throw badRequest("mcToken missing");
    try {
        const url = `${ENTITLEMENTS_BASE}/player/inventory?includeReceipt=${includeReceipt ? "true" : "false"}`;
        const {data} = await http.get(url, {headers: {Authorization: mcToken, Accept: "application/json"}});
        const entitlements = data?.result?.inventory?.entitlements || [];
        return entitlements;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) {
            throw unauthorized("Failed to get MC inventory", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get MC inventory", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw unauthorized("Failed to get MC inventory", detail);
        }
        throw internal("Failed to get MC inventory", detail);
    }
}

export async function getMCBalances(mcToken) {
    if (!mcToken) throw badRequest("mcToken missing");
    try {
        const url = `${ENTITLEMENTS_BASE}/currencies/virtual/balances`;
        const {data} = await http.post(url, {}, {headers: {Authorization: mcToken, Accept: "application/json"}});
        return data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) {
            throw unauthorized("Failed to get MC balances", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get MC balances", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw unauthorized("Failed to get MC balances", detail);
        }
        throw internal("Failed to get MC balances", detail);
    }
}

export async function getMCWishlistPage(mcToken, body = {}) {
    if (!mcToken) throw badRequest("mcToken missing");
    try {
        const url = `${STORE_BASE}/layout/pages/PagedList_Wishlist`;
        const inventoryVersion = body?.inventoryVersion;
        const res = await http.post(url, body, {
            headers: {
                Authorization: mcToken,
                Accept: "application/json",
                "content-type": "application/json", ...(inventoryVersion ? {
                    inventoryetag: inventoryVersion, inventoryversion: inventoryVersion
                } : {})
            }
        });

        const headerInventory = res.headers?.inventoryetag;
        const headerListsVersion = res.headers?.["x-userlists-version"];

        return {
            data: res.data, meta: {
                inventoryVersion: headerInventory || res.data?.result?.inventoryVersion,
                userListsVersion: headerListsVersion || res.data?.result?.userListsVersion
            }
        };
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) {
            throw unauthorized("Failed to get MC wishlist", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get MC wishlist", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw unauthorized("Failed to get MC wishlist", detail);
        }
        throw internal("Failed to get MC wishlist", detail);
    }
}

export async function updateMCWishlist(mcToken, body = {}) {
    if (!mcToken) throw badRequest("mcToken missing");
    try {
        const url = `${STORE_BASE}/player/list_wishlist`;
        const inventoryVersion = body?.inventoryVersion;
        const payload = {
            itemId: body.itemId, listVersion: body.listVersion, operation: body.operation
        };

        const res = await http.post(url, payload, {
            headers: {
                Authorization: mcToken,
                Accept: "application/json",
                "content-type": "application/json", ...(inventoryVersion ? {
                    inventoryetag: inventoryVersion, inventoryversion: inventoryVersion
                } : {})
            }
        });

        return {
            ok: true,
            userListsVersion: res.headers?.["x-userlists-version"] || res.headers?.etag,
            inventoryVersion: res.headers?.inventoryetag
        };
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) {
            throw unauthorized("Failed to update MC wishlist", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to update MC wishlist", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw unauthorized("Failed to update MC wishlist", detail);
        }
        throw internal("Failed to update MC wishlist", detail);
    }
}

export function buildMarketplaceMessagingPayload(options = {}) {
    const sessionId = options.sessionId || randomUUID();
    const sessionContext = typeof options.sessionContext === "string" ? options.sessionContext : "";
    const payload = {sessionId, sessionContext};

    if (options.previousSessionId) payload.previousSessionId = options.previousSessionId;
    if (options.continuationToken) payload.continuationToken = options.continuationToken;

    return {payload, sessionId};
}

export async function startMarketplaceMessagingSession(mcToken, options = {}) {
    if (!mcToken) throw badRequest("mcToken missing");
    try {
        const {payload, sessionId} = buildMarketplaceMessagingPayload(options);
        const sessionHeaderId = options.sessionHeaderId || sessionId;
        const url = `${MESSAGING_BASE}/session/start`;
        const res = await http.post(url, payload, {
            headers: {
                Authorization: mcToken,
                Accept: "application/json",
                "accept-language": env.ACCEPT_LANGUAGE,
                "content-type": "application/json",
                "session-id": sessionHeaderId
            }
        });

        return {
            data: res.data,
            headers: res.headers,
            sessionId,
            sessionHeaderId
        };
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) {
            throw unauthorized("Failed to start marketplace messaging session", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to start marketplace messaging session", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw unauthorized("Failed to start marketplace messaging session", detail);
        }
        throw internal("Failed to start marketplace messaging session", detail);
    }
}

export function buildMarketplaceMessageEventsPayload(options = {}) {
    const sessionId = options.sessionId || randomUUID();
    const sessionContext = typeof options.sessionContext === "string" ? options.sessionContext : "";
    const payload = {SessionId: sessionId, SessionContext: sessionContext};

    if (options.continuationToken) payload.continuationToken = options.continuationToken;

    const events = Array.isArray(options.events) ? options.events : null;
    if (events && events.length > 0) {
        payload.events = events.map(event => {
            const eventPayload = {
                eventType: event.eventType,
                instanceId: event.instanceId,
                reportId: event.reportId,
                sessionId: event.sessionId || sessionId
            };
            if (event.eventDateTime) eventPayload.eventDateTime = event.eventDateTime;
            return eventPayload;
        });
        return {payload, sessionId};
    }

    if (!options.eventType || !options.instanceId || !options.reportId) {
        throw badRequest("Missing messaging event data");
    }

    const eventPayload = {
        eventType: options.eventType,
        instanceId: options.instanceId,
        reportId: options.reportId,
        sessionId
    };
    if (options.eventDateTime) eventPayload.eventDateTime = options.eventDateTime;

    payload.events = [eventPayload];

    return {payload, sessionId};
}

export async function sendMarketplaceMessageEvents(mcToken, options = {}) {
    if (!mcToken) throw badRequest("mcToken missing");
    try {
        const {payload, sessionId} = buildMarketplaceMessageEventsPayload(options);
        const sessionHeaderId = options.sessionHeaderId || sessionId;
        const url = `${MESSAGING_BASE}/messages/event`;
        const res = await http.post(url, payload, {
            headers: {
                Authorization: mcToken,
                Accept: "application/json",
                "accept-language": env.ACCEPT_LANGUAGE,
                "content-type": "application/json",
                "session-id": sessionHeaderId
            }
        });

        return {
            data: res.data,
            headers: res.headers,
            sessionId,
            sessionHeaderId
        };
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) {
            throw unauthorized("Failed to send marketplace messaging event", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to send marketplace messaging event", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw unauthorized("Failed to send marketplace messaging event", detail);
        }
        throw internal("Failed to send marketplace messaging event", detail);
    }
}
