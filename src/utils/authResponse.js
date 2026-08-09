const REFRESH_SKEW_MS = 10 * 60 * 1000;

function toFutureTimestamp(value, now) {
    if (value === null || typeof value === "undefined" || value === "") return null;
    const numeric = Number(value);
    const timestamp = Number.isFinite(numeric) ? numeric : Date.parse(String(value));
    return Number.isFinite(timestamp) && timestamp > now ? timestamp : null;
}

export function buildAuthTiming(data, now = Date.now()) {
    const microsoftExpiresIn = Number(data.msExpiresIn);
    const microsoft = Number.isFinite(microsoftExpiresIn) && microsoftExpiresIn > 0
        ? now + microsoftExpiresIn * 1000
        : null;
    const tokenExpiresAt = {
        microsoft,
        xbox: toFutureTimestamp(data.xsts?.xbox?.NotAfter, now),
        redeem: toFutureTimestamp(data.xsts?.redeem?.NotAfter, now),
        playfab: toFutureTimestamp(data.xsts?.playfab?.NotAfter, now),
        entity: toFutureTimestamp(data.entityTokenExpiresOn, now),
        entityMaster: toFutureTimestamp(data.entityTokenMasterExpiresOn, now)
    };
    const expirations = Object.values(tokenExpiresAt).filter(Number.isFinite);
    const earliestExpiresAt = expirations.length ? Math.min(...expirations) : null;
    return {
        tokenIssuedAt: now,
        tokenExpiresAt,
        earliestExpiresAt,
        refreshAfter: earliestExpiresAt === null ? null : Math.max(now, earliestExpiresAt - REFRESH_SKEW_MS)
    };
}

export function buildAuthCallbackResponse(data, now = Date.now()) {
    const timing = buildAuthTiming(data, now);
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
        entityTokenMasterExpiresOn: data.entityTokenMasterExpiresOn,
        ...timing
    };
}
