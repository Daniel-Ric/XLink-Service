import {signJwt} from "../utils/jwt.js";
import {buildAuthCallbackResponse} from "../utils/authResponse.js";
import {getXBLToken, getXSTSToken} from "./xbox.service.js";
import {getEntityToken, loginWithXbox} from "./playfab.service.js";
import {getMCToken} from "./minecraft.service.js";
import {getMicrosoftOAuthConfig} from "./microsoft.service.js";

const REDEEM_RELYING_PARTY = "https://b980a380.minecraft.playfabapi.com/";

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
    const msAccessToken = tokenData.access_token;
    const msRefreshToken = tokenData.refresh_token;
    const msExpiresIn = tokenData.expires_in;
    const rpsTicket = getMicrosoftOAuthConfig(clientId).type === "modern" ? `d=${msAccessToken}` : msAccessToken;
    const xblToken = await dependencies.getXBLToken(rpsTicket);
    const xboxTokenInfo = await dependencies.getXSTSToken(xblToken, "http://xboxlive.com");
    const redeemTokenInfo = await dependencies.getXSTSToken(xblToken, REDEEM_RELYING_PARTY);
    const playfabTokenInfo = await dependencies.getXSTSToken(xblToken, "rp://playfabapi.com/");
    const xboxUserInfo = xboxTokenInfo.DisplayClaims?.xui?.[0] || {};
    const {xid, uhs, gtg} = xboxUserInfo;
    const xboxliveToken = `XBL3.0 x=${uhs};${xboxTokenInfo.Token}`;
    const redeemToken = `XBL3.0 x=${uhs};${redeemTokenInfo.Token}`;
    const playfabToken = `XBL3.0 x=${uhs};${playfabTokenInfo.Token}`;
    const {SessionTicket, PlayFabId} = await dependencies.loginWithXbox(playfabToken, titleId);
    const mcToken = await dependencies.getMCToken(SessionTicket);
    const entityData = await dependencies.getEntityToken(SessionTicket);
    const masterEntityData = PlayFabId ? await dependencies.getEntityToken(SessionTicket, {
        Type: "master_player_account",
        Id: PlayFabId
    }) : null;
    const jwtToken = dependencies.signJwt({xuid: xid, gamertag: gtg});

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
