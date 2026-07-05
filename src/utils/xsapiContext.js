import {badRequest} from "./httpError.js";
import {decodeMaybeProofKey} from "../services/xsapiCrypto.service.js";

function decodeJsonHeader(value, name) {
    if (!value) return null;
    const raw = Array.isArray(value) ? value[0] : String(value);
    try {
        return JSON.parse(raw);
    } catch {
        try {
            return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
        } catch {
            throw badRequest(`Invalid ${name} header`);
        }
    }
}

export function readXboxLiveToken(req) {
    return req.headers["x-xbl-token"] || req.headers["xbl-token"] || req.body?.xboxliveToken;
}

export function readXsapiContext(req) {
    const proofKeyJwk = decodeMaybeProofKey(req.body?.proofKeyJwk || req.headers["x-xsapi-proof-key"]);
    const xstsTokens = req.body?.xstsTokens || decodeJsonHeader(req.headers["x-xsapi-xsts-tokens"], "x-xsapi-xsts-tokens") || undefined;
    return {
        xboxliveToken: readXboxLiveToken(req),
        proofKeyJwk,
        deviceToken: req.body?.deviceToken,
        titleToken: req.body?.titleToken,
        userToken: req.body?.userToken,
        authorizationToken: req.body?.authorizationToken,
        xstsTokens,
        relyingParty: req.body?.relyingParty
    };
}
