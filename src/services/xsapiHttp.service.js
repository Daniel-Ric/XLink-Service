import {badRequest, forbidden, internal, unauthorized} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";
import {env} from "../config/env.js";
import {resolveNsal} from "./xsapiNsal.service.js";
import {signXboxRequest} from "./xsapiCrypto.service.js";
import {authorizeXstsSigned, toXstsAuthorizationHeader} from "./xsapiAuth.service.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);

function bodyToWire(body) {
    if (body == null) return {data: undefined, buffer: Buffer.alloc(0)};
    if (Buffer.isBuffer(body)) return {data: body, buffer: body};
    if (typeof body === "string") return {data: body, buffer: Buffer.from(body)};
    const json = JSON.stringify(body);
    return {data: json, buffer: Buffer.from(json)};
}

function normalizeXstsToken(value) {
    if (!value) return null;
    if (typeof value === "string") return value;
    return toXstsAuthorizationHeader(value);
}

async function tokenForRelyingParty(relyingParty, context = {}) {
    const direct = context.xstsTokens?.[relyingParty] || context.xstsTokens?.[String(relyingParty).replace(/\/$/, "")];
    if (direct) return normalizeXstsToken(direct);
    if (relyingParty === "http://xboxlive.com" && context.xboxliveToken) return context.xboxliveToken;
    if (context.authorizationToken && relyingParty === "http://xboxlive.com") return normalizeXstsToken(context.authorizationToken);

    if (context.proofKeyJwk && context.deviceToken && context.titleToken && context.userToken) {
        const token = await authorizeXstsSigned({
            proofKeyJwk: context.proofKeyJwk,
            relyingParty,
            deviceToken: context.deviceToken,
            titleToken: context.titleToken,
            userToken: context.userToken
        });
        context.xstsTokens = {...context.xstsTokens, [relyingParty]: token};
        return normalizeXstsToken(token);
    }

    if (context.xboxliveToken) return context.xboxliveToken;
    throw badRequest(`Missing XSTS token for relying party ${relyingParty}`);
}

function httpError(err, message) {
    const status = err.response?.status;
    const detail = err.response?.data || err.message;
    if (status === 401) throw unauthorized(message, detail);
    if (status === 403) throw forbidden(message, detail);
    if (status && status >= 400 && status < 500) throw badRequest(message, detail);
    throw internal(message, detail);
}

export async function xsapiRequest({
    method = "GET",
    url,
    body,
    headers = {},
    authContext = {},
    contractVersion,
    titleIds,
    sign = true,
    validateStatus
}) {
    if (!url) throw badRequest("url is required");
    const upperMethod = String(method).toUpperCase();
    const {data, buffer} = bodyToWire(body);
    const requestHeaders = {
        Accept: "application/json",
        ...(body != null ? {"Content-Type": "application/json"} : {}),
        ...(contractVersion ? {"x-xbl-contract-version": String(contractVersion)} : {}),
        ...headers
    };

    let nsal = null;
    if (sign || !requestHeaders.Authorization) {
        nsal = await resolveNsal(url, {
            xboxliveToken: authContext.xboxliveToken,
            proofKeyJwk: authContext.proofKeyJwk,
            titleIds: titleIds || (authContext.proofKeyJwk && authContext.xboxliveToken ? ["current", "default"] : ["default"]),
            titleData: authContext.titleData
        });
    }

    const relyingParty = authContext.relyingParty || nsal?.endpoint?.RelyingParty || "http://xboxlive.com";
    requestHeaders.Authorization = requestHeaders.Authorization || await tokenForRelyingParty(relyingParty, authContext);

    if (sign && authContext.proofKeyJwk) {
        requestHeaders.Signature = signXboxRequest({
            method: upperMethod,
            url,
            authorization: requestHeaders.Authorization,
            headers: requestHeaders,
            body: buffer,
            proofKeyJwk: authContext.proofKeyJwk,
            policy: nsal?.policy
        });
    }

    try {
        const response = await http.request({
            method: upperMethod,
            url,
            data,
            headers: requestHeaders,
            validateStatus: validateStatus || (s => s >= 200 && s < 300)
        });
        return {
            data: response.data,
            status: response.status,
            headers: response.headers,
            nsal: nsal ? {
                source: nsal.source,
                relyingParty,
                host: nsal.endpoint?.Host,
                hostType: nsal.endpoint?.HostType
            } : null
        };
    } catch (err) {
        httpError(err, "XSAPI request failed");
    }
}
