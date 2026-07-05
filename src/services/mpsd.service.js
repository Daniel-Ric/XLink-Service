import crypto from "node:crypto";
import {badRequest} from "../utils/httpError.js";
import {xsapiRequest} from "./xsapiHttp.service.js";
import {env} from "../config/env.js";

const MPSD_BASE = "https://sessiondirectory.xboxlive.com";
const CONTRACT_VERSION = 107;
const sessions = new Map();
const ttlMs = Number(env.XSAPI_SESSION_TTL_MS || 10 * 60 * 1000);

function sessionKey(ref) {
    return `${ref.scid}/${ref.templateName}/${ref.name}`.toLowerCase();
}

function rememberSession(ref, data = {}) {
    if (!ref?.scid || !ref?.templateName || !ref?.name) return null;
    const key = sessionKey(ref);
    const now = Date.now();
    const record = {
        id: key,
        ref,
        data,
        createdAt: sessions.get(key)?.createdAt || now,
        touchedAt: now,
        expiresAt: now + ttlMs
    };
    sessions.set(key, record);
    return record;
}

function parseContentLocation(value) {
    if (!value) return null;
    const url = new URL(value, MPSD_BASE);
    const parts = url.pathname.split("/").filter(Boolean);
    const serviceConfigIndex = parts.findIndex(part => part.toLowerCase() === "serviceconfigs");
    if (serviceConfigIndex === -1 || parts.length < serviceConfigIndex + 6) return null;
    return {
        scid: parts[serviceConfigIndex + 1],
        templateName: parts[serviceConfigIndex + 3],
        name: parts[serviceConfigIndex + 5]
    };
}

function refUrl(ref) {
    if (!ref?.scid) throw badRequest("scid is required");
    if (!ref?.templateName) throw badRequest("templateName is required");
    if (!ref?.name) throw badRequest("name is required");
    return `${MPSD_BASE}/serviceconfigs/${encodeURIComponent(ref.scid)}/sessionTemplates/${encodeURIComponent(ref.templateName)}/sessions/${encodeURIComponent(ref.name)}`;
}

function cleanRaw(value) {
    if (value == null) return undefined;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed;
        }
    }
    return value;
}

function memberDescription(xuid, {connectionId, subscriptionId, customMemberProperties, customMemberConstants} = {}) {
    return {
        constants: {
            system: {
                initialize: true,
                xuid
            },
            ...(customMemberConstants != null ? {custom: cleanRaw(customMemberConstants)} : {})
        },
        properties: {
            system: {
                active: true,
                ...(connectionId ? {connection: connectionId} : {}),
                ...(subscriptionId ? {
                    subscription: {
                        id: subscriptionId,
                        changeTypes: ["everything"]
                    }
                } : {})
            },
            ...(customMemberProperties != null ? {custom: cleanRaw(customMemberProperties)} : {})
        }
    };
}

function publishBody(ref, xuid, config = {}) {
    const body = {
        properties: {
            system: {
                joinRestriction: config.joinRestriction || "followed",
                readRestriction: config.readRestriction || "followed"
            },
            ...(config.customProperties != null ? {custom: cleanRaw(config.customProperties)} : {})
        },
        members: {
            me: memberDescription(xuid, {
                connectionId: config.connectionId,
                subscriptionId: config.subscriptionId || crypto.randomUUID().toUpperCase(),
                customMemberProperties: config.customMemberProperties,
                customMemberConstants: config.customMemberConstants
            })
        }
    };
    if (config.customConstants != null) {
        body.constants = {custom: cleanRaw(config.customConstants)};
    }
    return body;
}

export function cleanupMpsdSessions(now = Date.now()) {
    let removed = 0;
    for (const [key, record] of sessions) {
        if (record.expiresAt <= now) {
            sessions.delete(key);
            removed += 1;
        }
    }
    return removed;
}

export function listMpsdSessions() {
    cleanupMpsdSessions();
    return Array.from(sessions.values()).sort((a, b) => b.touchedAt - a.touchedAt);
}

export async function getSession(ref, authContext) {
    const response = await xsapiRequest({
        method: "GET",
        url: refUrl(ref),
        contractVersion: CONTRACT_VERSION,
        authContext
    });
    rememberSession(ref, response.data);
    return response;
}

export async function queryActivities({scid, xuids = [], socialGroup = "people", include = "relatedInfo,customProperties"} = {}, authContext = {}) {
    if (!scid) throw badRequest("scid is required");
    const xuid = authContext.xuid;
    const body = {
        type: "activity",
        scid,
        owners: {
            ...(Array.isArray(xuids) && xuids.length ? {xuids} : {}),
            people: {
                moniker: socialGroup,
                ...(xuid ? {monikerXuid: xuid} : {})
            }
        }
    };
    const response = await xsapiRequest({
        method: "POST",
        url: `${MPSD_BASE}/handles/query?include=${encodeURIComponent(include)}`,
        body,
        contractVersion: CONTRACT_VERSION,
        authContext
    });
    return {
        ...response,
        activities: response.data?.results || []
    };
}

export async function publishSession(ref, config, authContext = {}) {
    const name = ref.name || crypto.randomUUID().toUpperCase();
    const fullRef = {...ref, name};
    const response = await xsapiRequest({
        method: "PUT",
        url: refUrl(fullRef),
        body: publishBody(fullRef, authContext.xuid, config),
        headers: {"If-None-Match": "*"},
        contractVersion: CONTRACT_VERSION,
        authContext,
        validateStatus: s => s === 201
    });
    rememberSession(fullRef, response.data);
    if (config.writeActivity !== false) {
        await writeActivity(fullRef, authContext);
    }
    return {...response, ref: fullRef};
}

export async function joinSession(handleId, config, authContext = {}) {
    if (!handleId) throw badRequest("handleId is required");
    const body = {
        members: {
            me: memberDescription(authContext.xuid, {
                connectionId: config.connectionId,
                subscriptionId: config.subscriptionId || crypto.randomUUID().toUpperCase(),
                customMemberProperties: config.customMemberProperties,
                customMemberConstants: config.customMemberConstants
            })
        }
    };
    const response = await xsapiRequest({
        method: "PUT",
        url: `${MPSD_BASE}/handles/${encodeURIComponent(handleId)}/session`,
        body,
        headers: {"If-Match": "*"},
        contractVersion: CONTRACT_VERSION,
        authContext,
        validateStatus: s => s === 200
    });
    const ref = parseContentLocation(response.headers?.["content-location"]);
    if (ref) rememberSession(ref, response.data);
    return {...response, ref};
}

export async function writeActivity(ref, authContext = {}) {
    const response = await xsapiRequest({
        method: "POST",
        url: `${MPSD_BASE}/handles`,
        body: {
            type: "activity",
            sessionRef: {
                scid: ref.scid,
                templateName: ref.templateName,
                name: ref.name
            },
            version: 1
        },
        contractVersion: CONTRACT_VERSION,
        authContext
    });
    return response;
}

export async function inviteToSession(ref, {xuid, titleId, contextString, context} = {}, authContext = {}) {
    if (!xuid) throw badRequest("xuid is required");
    if (!titleId) throw badRequest("titleId is required");
    const response = await xsapiRequest({
        method: "POST",
        url: `${MPSD_BASE}/handles`,
        body: {
            type: "invite",
            sessionRef: {
                scid: ref.scid,
                templateName: ref.templateName,
                name: ref.name
            },
            version: 1,
            invitedXuid: xuid,
            inviteAttributes: {
                titleId,
                ...(contextString ? {contextString} : {}),
                ...(context ? {context} : {})
            }
        },
        contractVersion: CONTRACT_VERSION,
        authContext
    });
    return response;
}

export async function setSessionCustomProperties(ref, customProperties, authContext = {}) {
    const response = await xsapiRequest({
        method: "PUT",
        url: refUrl(ref),
        body: {
            properties: {
                custom: cleanRaw(customProperties)
            }
        },
        headers: {"If-Match": "*"},
        contractVersion: CONTRACT_VERSION,
        authContext,
        validateStatus: s => s === 200 || s === 204
    });
    rememberSession(ref, response.data);
    return response;
}

export async function setMemberCustomProperties(ref, label, customProperties, authContext = {}) {
    if (!label) throw badRequest("label is required");
    const response = await xsapiRequest({
        method: "PUT",
        url: refUrl(ref),
        body: {
            members: {
                [label]: {
                    properties: {
                        custom: cleanRaw(customProperties)
                    }
                }
            }
        },
        headers: {"If-Match": "*"},
        contractVersion: CONTRACT_VERSION,
        authContext,
        validateStatus: s => s === 200 || s === 204
    });
    rememberSession(ref, response.data);
    return response;
}

export async function closeSession(ref, authContext = {}) {
    const response = await xsapiRequest({
        method: "PUT",
        url: refUrl(ref),
        body: {
            members: {
                me: null
            }
        },
        headers: {"If-Match": "*"},
        contractVersion: CONTRACT_VERSION,
        authContext,
        validateStatus: s => s === 200 || s === 204
    });
    sessions.delete(sessionKey(ref));
    return response;
}
