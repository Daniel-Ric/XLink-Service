import crypto from "node:crypto";
import {badRequest, internal, notFound} from "../utils/httpError.js";
import {env} from "../config/env.js";
import {resolveNsal} from "./xsapiNsal.service.js";
import {signXboxRequest} from "./xsapiCrypto.service.js";

const CONNECT_HTTP_URL = "https://rta.xboxlive.com/connect";
const CONNECT_WS_URL = "wss://rta.xboxlive.com/connect";
const SUBPROTOCOL = "rta.xboxlive.com.V2";
const TYPE_SUBSCRIBE = 1;
const TYPE_UNSUBSCRIBE = 2;
const TYPE_EVENT = 3;
const TYPE_RESYNC = 4;
const STATUS_OK = 0;
const ttlMs = Number(env.XSAPI_SESSION_TTL_MS || 10 * 60 * 1000);
const connections = new Map();

function normalizeMessage(data) {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
    if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
    return String(data || "");
}

function makeError(status, payload) {
    const message = payload?.[0]?.Message || payload?.[0]?.message || payload?.[0] || `RTA status ${status}`;
    return new Error(typeof message === "string" ? message : JSON.stringify(message));
}

class RtaConnection {
    constructor(id, authContext = {}) {
        this.id = id;
        this.authContext = authContext;
        this.createdAt = Date.now();
        this.touchedAt = this.createdAt;
        this.expiresAt = this.createdAt + ttlMs;
        this.state = "created";
        this.seq = {
            [TYPE_SUBSCRIBE]: 0,
            [TYPE_UNSUBSCRIBE]: 0
        };
        this.expected = new Map();
        this.subscriptions = new Map();
        this.events = [];
        this.eventSeq = 0;
    }

    touch() {
        this.touchedAt = Date.now();
        this.expiresAt = this.touchedAt + ttlMs;
    }

    async connect() {
        if (typeof WebSocket !== "function") {
            throw internal("RTA requires a runtime with WebSocket support");
        }
        if (!this.authContext.xboxliveToken) throw badRequest("Missing x-xbl-token header");
        this.touch();
        const headers = {
            Authorization: this.authContext.xboxliveToken
        };
        if (this.authContext.proofKeyJwk) {
            const nsal = await resolveNsal(CONNECT_HTTP_URL, {
                xboxliveToken: this.authContext.xboxliveToken,
                proofKeyJwk: this.authContext.proofKeyJwk,
                titleIds: ["default"]
            });
            headers.Signature = signXboxRequest({
                method: "GET",
                url: CONNECT_HTTP_URL,
                authorization: headers.Authorization,
                headers,
                proofKeyJwk: this.authContext.proofKeyJwk,
                policy: nsal.policy
            });
        }

        this.state = "connecting";
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(CONNECT_WS_URL, SUBPROTOCOL, {headers});
            this.ws = ws;
            const timeout = setTimeout(() => {
                reject(new Error("RTA connect timeout"));
                try {
                    ws.close();
                } catch {
                }
            }, 15000);
            ws.addEventListener("open", () => {
                clearTimeout(timeout);
                this.state = "open";
                resolve();
            }, {once: true});
            ws.addEventListener("error", (event) => {
                clearTimeout(timeout);
                const err = event?.error || new Error("RTA websocket error");
                if (this.state === "connecting") reject(err);
                this.pushEvent("error", {message: err.message});
            });
            ws.addEventListener("close", (event) => {
                this.state = "closed";
                for (const {reject: rejectPending, timer} of this.expected.values()) {
                    clearTimeout(timer);
                    rejectPending(new Error("RTA connection closed"));
                }
                this.expected.clear();
                this.pushEvent("close", {code: event.code, reason: event.reason});
            });
            ws.addEventListener("message", (event) => this.handleMessage(event.data));
        });
        return this;
    }

    handleMessage(data) {
        this.touch();
        let message;
        try {
            message = JSON.parse(normalizeMessage(data));
        } catch (err) {
            this.pushEvent("decode_error", {message: err.message, raw: normalizeMessage(data)});
            return;
        }
        const type = message[0];
        if (type === TYPE_SUBSCRIBE || type === TYPE_UNSUBSCRIBE) {
            const sequence = message[1];
            const status = message[2];
            const payload = message.slice(3);
            const key = `${type}:${sequence}`;
            const pending = this.expected.get(key);
            if (!pending) return;
            clearTimeout(pending.timer);
            this.expected.delete(key);
            if (status !== STATUS_OK) {
                pending.reject(makeError(status, payload));
                return;
            }
            pending.resolve(payload);
            return;
        }
        if (type === TYPE_EVENT) {
            this.pushEvent("event", {
                subscriptionId: message[1],
                custom: message[2]
            });
            return;
        }
        if (type === TYPE_RESYNC) {
            this.pushEvent("resync", {payload: message.slice(1)});
            return;
        }
        this.pushEvent("unknown", {message});
    }

    pushEvent(type, payload) {
        const event = {
            seq: ++this.eventSeq,
            type,
            payload,
            at: new Date().toISOString()
        };
        this.events.push(event);
        if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
    }

    call(type, payload = []) {
        if (this.state !== "open" || this.ws?.readyState !== WebSocket.OPEN) {
            throw badRequest("RTA connection is not open");
        }
        this.touch();
        const sequence = ++this.seq[type];
        const key = `${type}:${sequence}`;
        const message = [type, sequence, ...payload];
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.expected.delete(key);
                reject(new Error("RTA call timeout"));
            }, 15000);
            this.expected.set(key, {resolve, reject, timer});
            this.ws.send(JSON.stringify(message));
        });
    }

    async subscribe(resourceUri) {
        if (!resourceUri) throw badRequest("resourceUri is required");
        const payload = await this.call(TYPE_SUBSCRIBE, [resourceUri]);
        const subscriptionId = payload[0];
        const custom = payload[1];
        this.subscriptions.set(String(subscriptionId), {subscriptionId, resourceUri, custom});
        return {subscriptionId, resourceUri, custom};
    }

    async unsubscribe(subscriptionId) {
        if (subscriptionId == null) throw badRequest("subscriptionId is required");
        await this.call(TYPE_UNSUBSCRIBE, [Number(subscriptionId)]);
        this.subscriptions.delete(String(subscriptionId));
        return {ok: true, subscriptionId: Number(subscriptionId)};
    }

    eventSlice(since = 0) {
        this.touch();
        return this.events.filter(event => event.seq > Number(since || 0));
    }

    snapshot() {
        return {
            id: this.id,
            state: this.state,
            createdAt: this.createdAt,
            touchedAt: this.touchedAt,
            expiresAt: this.expiresAt,
            subscriptions: Array.from(this.subscriptions.values()),
            eventSeq: this.eventSeq
        };
    }

    close() {
        this.state = "closed";
        try {
            this.ws?.close();
        } catch {
        }
    }
}

export function cleanupRtaConnections(now = Date.now()) {
    let removed = 0;
    for (const [id, connection] of connections) {
        if (connection.expiresAt <= now) {
            connection.close();
            connections.delete(id);
            removed += 1;
        }
    }
    return removed;
}

export async function createRtaConnection(authContext) {
    cleanupRtaConnections();
    const id = crypto.randomUUID();
    const connection = new RtaConnection(id, authContext);
    connections.set(id, connection);
    try {
        await connection.connect();
        return connection.snapshot();
    } catch (err) {
        connections.delete(id);
        throw internal("Failed to connect RTA", err.message);
    }
}

export function getRtaConnection(id) {
    cleanupRtaConnections();
    const connection = connections.get(id);
    if (!connection) throw notFound("RTA connection not found");
    connection.touch();
    return connection;
}

export function listRtaConnections() {
    cleanupRtaConnections();
    return Array.from(connections.values()).map(connection => connection.snapshot());
}

export function closeRtaConnection(id) {
    const connection = getRtaConnection(id);
    connection.close();
    connections.delete(id);
    return {ok: true};
}
