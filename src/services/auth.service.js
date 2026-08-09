import {signJwt} from "../utils/jwt.js";
import {buildAuthCallbackResponse} from "../utils/authResponse.js";
import {getXBLToken, getXSTSToken} from "./xbox.service.js";
import {getEntityToken, loginWithXbox} from "./playfab.service.js";
import {getMCToken} from "./minecraft.service.js";
import {getMicrosoftOAuthConfig} from "./microsoft.service.js";
import {badGateway} from "../utils/httpError.js";
import {buildTokenBindings} from "../utils/tokenBinding.js";

const REDEEM_RELYING_PARTY = "https://b980a380.minecraft.playfabapi.com/";

function requiredString(value, field) {
    if (typeof value !== "string" || !value.trim()) throw badGateway(`Invalid upstream authentication response: missing ${field}`);
    return value;
}

function futureTimestamp(value, field) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
        throw badGateway(`Invalid upstream authentication response: invalid ${field}`);
    }
    return value;
}

function validateXsts(value, field, requireIdentity = false) {
    if (!value || typeof value !== "object") throw badGateway(`Invalid upstream authentication response: missing ${field}`);
    requiredString(value.Token, `${field}.Token`);
    futureTimestamp(value.NotAfter, `${field}.NotAfter`);
    if (requireIdentity) {
        const identity = value.DisplayClaims?.xui?.[0];
        requiredString(identity?.xid, `${field}.DisplayClaims.xui[0].xid`);
        requiredString(identity?.uhs, `${field}.DisplayClaims.xui[0].uhs`);
    }
    return value;
}

export async function exchangeMicrosoftTokenBundle(tokenData, clientId, titleId, overrides = {}) {
    const dependencies = {
        signJwt,
        getXBLToken,
        getXSTSToken,
        loginWithXbox,
        getMCToken,
        getEntityToken,
        ...overrides
    };
    if (!tokenData || typeof tokenData !== "object" || tokenData.error) {
        throw badGateway("Invalid Microsoft token response");
    }
    const msAccessToken = requiredString(tokenData.access_token, "access_token");
    const msRefreshToken = requiredString(tokenData.refresh_token, "refresh_token");
    const msExpiresIn = tokenData.expires_in;
    if (!Number.isInteger(Number(msExpiresIn)) || Number(msExpiresIn) <= 0) {
        throw badGateway("Invalid upstream authentication response: invalid expires_in");
    }
    const rpsTicket = getMicrosoftOAuthConfig(clientId).type === "modern" ? `d=${msAccessToken}` : msAccessToken;
    const xblToken = await dependencies.getXBLToken(rpsTicket);
    const xboxTokenInfo = await dependencies.getXSTSToken(xblToken, "http://xboxlive.com");
    const redeemTokenInfo = await dependencies.getXSTSToken(xblToken, REDEEM_RELYING_PARTY);
    const playfabTokenInfo = await dependencies.getXSTSToken(xblToken, "rp://playfabapi.com/");
    validateXsts(xboxTokenInfo, "xbox XSTS", true);
    validateXsts(redeemTokenInfo, "redeem XSTS");
    validateXsts(playfabTokenInfo, "PlayFab XSTS");
    const xboxUserInfo = xboxTokenInfo.DisplayClaims?.xui?.[0] || {};
    const {xid, uhs, gtg} = xboxUserInfo;
    const xboxliveToken = `XBL3.0 x=${uhs};${xboxTokenInfo.Token}`;
    const redeemToken = `XBL3.0 x=${uhs};${redeemTokenInfo.Token}`;
    const playfabToken = `XBL3.0 x=${uhs};${playfabTokenInfo.Token}`;
    const playFabLogin = await dependencies.loginWithXbox(playfabToken, titleId);
    const SessionTicket = requiredString(playFabLogin?.SessionTicket, "PlayFab SessionTicket");
    const PlayFabId = requiredString(playFabLogin?.PlayFabId, "PlayFabId");
    const mcToken = requiredString(await dependencies.getMCToken(SessionTicket), "Minecraft token");
    const entityData = await dependencies.getEntityToken(SessionTicket);
    requiredString(entityData?.EntityToken, "PlayFab entity token");
    futureTimestamp(entityData?.TokenExpiration, "PlayFab entity token expiration");
    const masterEntityData = PlayFabId ? await dependencies.getEntityToken(SessionTicket, {
        Type: "master_player_account",
        Id: PlayFabId
    }) : null;
    requiredString(masterEntityData?.EntityToken, "PlayFab master entity token");
    futureTimestamp(masterEntityData?.TokenExpiration, "PlayFab master entity token expiration");
    const jwtToken = dependencies.signJwt({
        xuid: xid,
        gamertag: gtg,
        uhs,
        tokenBindings: buildTokenBindings({
            xboxlive: xboxliveToken,
            playfab: playfabToken,
            redeem: redeemToken,
            minecraft: mcToken,
            sessionTicket: SessionTicket
        })
    });

    return buildAuthCallbackResponse({
        jwtToken,
        xuid: xid,
        gamertag: gtg,
        uhs,
        msAccessToken,
        msRefreshToken,
        msExpiresIn,
        xblToken,
        xsts: {xbox: xboxTokenInfo, redeem: redeemTokenInfo, playfab: playfabTokenInfo},
        xboxliveToken,
        playfabToken,
        redeemToken,
        mcToken,
        sessionTicket: SessionTicket,
        playFabId: PlayFabId,
        entityToken: entityData.EntityToken,
        entityTokenExpiresOn: entityData.TokenExpiration,
        entityTokenMaster: masterEntityData?.EntityToken,
        entityTokenMasterExpiresOn: masterEntityData?.TokenExpiration
    });
}
