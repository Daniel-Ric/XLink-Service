import crypto from "node:crypto";
import {env} from "../config/env.js";
import {badRequest, internal} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";
import {cached} from "../utils/cache.js";
import {signXboxRequest} from "./xsapiCrypto.service.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);
const NSAL_BASE = "https://title.mgt.xboxlive.com";
const AUTH_POLICY = {Version: 1};

let defaultTitleDataPromise = null;
let defaultTitleData = null;

function tokenFingerprint(token) {
    return crypto.createHash("sha256").update(String(token || "")).digest("hex").slice(0, 16);
}

function effectivePort(url) {
    if (url.port) return url.port;
    if (url.protocol === "https:") return "443";
    if (url.protocol === "http:") return "80";
    return "";
}

function wildcardMatches(pattern, hostname) {
    if (!pattern?.startsWith("*")) return false;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(hostname);
}

function endpointMatches(endpoint, url) {
    if (!endpoint?.RelyingParty) return false;
    if (endpoint.Protocol && endpoint.Protocol !== url.protocol.replace(":", "")) return false;

    const hostname = url.hostname;
    let hostMatches = false;
    switch (String(endpoint.HostType || "").toLowerCase()) {
        case "fqdn":
            hostMatches = String(endpoint.Host || "").toLowerCase() === hostname.toLowerCase();
            break;
        case "wildcard":
            hostMatches = wildcardMatches(endpoint.Host, hostname);
            break;
        case "cidr":
            hostMatches = false;
            break;
        default:
            hostMatches = String(endpoint.Host || "").toLowerCase() === hostname.toLowerCase();
            break;
    }

    if (!hostMatches) return false;
    if (endpoint.Port && String(endpoint.Port) !== effectivePort(url)) return false;
    return !endpoint.Path || endpoint.Path === url.pathname;
}

export function matchTitleData(titleData, targetUrl) {
    if (!titleData?.EndPoints?.length) return null;
    const url = targetUrl instanceof URL ? targetUrl : new URL(targetUrl);
    let match = null;

    for (const endpoint of titleData.EndPoints) {
        if (!endpointMatches(endpoint, url)) continue;
        const index = endpoint.SignaturePolicyIndex;
        const policy = Number.isInteger(index) && index >= 0 && index < (titleData.SignaturePolicies || []).length
            ? titleData.SignaturePolicies[index]
            : AUTH_POLICY;
        match = {endpoint, policy};
        if (String(endpoint.HostType || "").toLowerCase() === "fqdn") break;
    }

    return match;
}

export async function getDefaultTitleData() {
    if (defaultTitleData) return defaultTitleData;
    if (!defaultTitleDataPromise) {
        defaultTitleDataPromise = http.get(`${NSAL_BASE}/titles/default/endpoints?type=1`, {
            headers: {"x-xbl-contract-version": "1"}
        }).then(({data}) => {
            if (!data?.EndPoints) throw internal("Invalid NSAL default title data");
            defaultTitleData = data;
            return data;
        }).finally(() => {
            defaultTitleDataPromise = null;
        });
    }
    return defaultTitleDataPromise;
}

export async function getTitleData(titleId, {xboxliveToken, proofKeyJwk} = {}) {
    if (!titleId) throw badRequest("titleId is required");
    if (!xboxliveToken) throw badRequest("xboxliveToken is required for title NSAL data");
    if (!proofKeyJwk) throw badRequest("proofKeyJwk is required for title NSAL data");

    const cacheKey = ["nsal-title", titleId, tokenFingerprint(xboxliveToken)];
    return cached(cacheKey, async () => {
        const url = `${NSAL_BASE}/titles/${encodeURIComponent(titleId)}/endpoints`;
        const headers = {
            "x-xbl-contract-version": "1",
            Authorization: xboxliveToken
        };
        headers.Signature = signXboxRequest({
            method: "GET",
            url,
            authorization: xboxliveToken,
            headers,
            proofKeyJwk,
            policy: AUTH_POLICY
        });
        const {data} = await http.get(url, {headers});
        if (!data?.EndPoints) throw internal("Invalid NSAL title data");
        return data;
    }, 5 * 60 * 1000);
}

export async function resolveNsal(targetUrl, {
    xboxliveToken,
    proofKeyJwk,
    titleIds = ["current", "default"],
    titleData = []
} = {}) {
    const url = targetUrl instanceof URL ? targetUrl : new URL(targetUrl);
    const configuredTitleData = Array.isArray(titleData) ? titleData : [titleData].filter(Boolean);

    for (const data of configuredTitleData) {
        const match = matchTitleData(data, url);
        if (match) return {...match, source: "provided"};
    }

    const errors = [];
    for (const titleId of titleIds || []) {
        let data;
        try {
            data = titleId === "default"
                ? await getDefaultTitleData()
                : await getTitleData(titleId, {xboxliveToken, proofKeyJwk});
        } catch (err) {
            errors.push({titleId, message: err.message});
            continue;
        }
        const match = matchTitleData(data, url);
        if (match) return {...match, source: titleId};
    }

    const details = errors.length ? {url: url.toString(), errors} : {url: url.toString()};
    throw badRequest("No NSAL endpoint matched request URL", details);
}

export function authSignaturePolicy() {
    return AUTH_POLICY;
}
