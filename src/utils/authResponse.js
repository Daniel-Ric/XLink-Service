export function buildAuthCallbackResponse(data) {
    return {
        jwt: data.jwtToken,
        xuid: data.xuid,
        gamertag: data.gamertag,
        uhs: data.uhs,
        msAccessToken: data.msAccessToken,
        msRefreshToken: data.msRefreshToken,
        msExpiresIn: data.msExpiresIn,
        xblToken: data.xblToken,
        xsts: data.xsts,
        xboxliveToken: data.xboxliveToken,
        playfabToken: data.playfabToken,
        redeemToken: data.redeemToken,
        mcToken: data.mcToken,
        sessionTicket: data.sessionTicket,
        playFabId: data.playFabId,
        entityToken: data.entityToken,
        entityTokenExpiresOn: data.entityTokenExpiresOn,
        entityTokenMaster: data.entityTokenMaster,
        entityTokenMasterExpiresOn: data.entityTokenMasterExpiresOn
    };
}
