import crypto from "node:crypto";

import {env} from "../config/env.js";
import {badRequest, forbidden, internal, unauthorized} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";

const REDEEM_BASE = "https://buynow.production.store-web.dynamics.com/v1.0/Redeem";
const APP_ID = "RedeemNow";

const http = createHttp(env.HTTP_TIMEOUT_MS);

function normalizeLocale(locale) {
    if (typeof locale !== "string") return "en-US";
    const raw = locale.split(",")[0].trim();
    return raw || "en-US";
}

function normalizeMarket(market) {
    if (typeof market !== "string") return "US";
    const raw = market.trim().toUpperCase();
    return raw || "US";
}

function defaultFlights() {
    return ["sc_reactredeem", "sc_reactredeemv2", "sc_redeemcontainer", "sc_minecraftredeem"];
}

function buildHeaders(redeemToken, {locale, correlationId} = {}) {
    if (!redeemToken) throw badRequest("redeemToken is required");
    const headers = {
        Accept: "application/json", "content-type": "application/json", Authorization: redeemToken
    };
    if (locale) headers["accept-language"] = normalizeLocale(locale);
    if (correlationId) headers["ms-cv"] = String(correlationId);
    return headers;
}

function buildBasePayload({market, locale, flights, clientContext} = {}) {
    return {
        market: normalizeMarket(market),
        locale: normalizeLocale(locale),
        buyNowScenario: "redeem",
        supportsCsvTypeTokenOnly: false,
        clientContext: clientContext || {client: "MinecraftNet", deviceFamily: "Web"},
        flights: Array.isArray(flights) && flights.length ? flights : defaultFlights()
    };
}

export async function prepareRedeem(redeemToken, {
    code,
    market,
    locale,
    flights,
    clientContext
} = {}, {correlationId} = {}) {
    if (!code || typeof code !== "string") throw badRequest("code is required");

    const url = `${REDEEM_BASE}/PrepareRedeem?appId=${encodeURIComponent(APP_ID)}&context=LookupToken`;
    const payload = {
        ...buildBasePayload({market, locale, flights, clientContext}), tokenIdentifierValue: code.trim()
    };

    try {
        const {data} = await http.post(url, payload, {headers: buildHeaders(redeemToken, {locale, correlationId})});
        return data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) throw unauthorized("Failed to lookup redeem token", detail);
        if (status === 403) throw forbidden("Failed to lookup redeem token", detail);
        throw internal("Failed to lookup redeem token", detail);
    }
}

export async function redeemCode(redeemToken, {
    code,
    paymentSessionId,
    market,
    locale,
    flights,
    clientContext
} = {}, {correlationId} = {}) {
    if (!code || typeof code !== "string") throw badRequest("code is required");
    if (!paymentSessionId || typeof paymentSessionId !== "string") throw badRequest("paymentSessionId is required");

    const url = `${REDEEM_BASE}/RedeemToken?appId=${encodeURIComponent(APP_ID)}`;
    const payload = {
        ...buildBasePayload({market, locale, flights, clientContext}),
        tokenIdentifierValue: code.trim(),
        paymentInstrumentId: code.trim(),
        paymentSessionId,
        refreshPaymentInstrument: true,
        riskRelatedId: crypto.randomUUID()
    };

    try {
        const {data} = await http.post(url, payload, {headers: buildHeaders(redeemToken, {locale, correlationId})});
        return data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) throw unauthorized("Failed to redeem code", detail);
        if (status === 403) throw forbidden("Failed to redeem code", detail);
        throw internal("Failed to redeem code", detail);
    }
}
