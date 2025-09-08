import { env } from "../config/env.js";
import { badRequest, internal } from "../utils/httpError.js";
import { createHttp } from "../utils/http.js";
import { cached } from "../utils/cache.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);

export async function getXBLToken(msAccessToken) {
    try {
        const { data } = await http.post("https://user.auth.xboxlive.com/user/authenticate", { Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: msAccessToken }, RelyingParty: "http://auth.xboxlive.com", TokenType: "JWT" });
        return data.Token;
    } catch (err) {
        throw internal("Failed to get XBL token", err.response?.data || err.message);
    }
}

export async function getXSTSToken(xblToken, relyingParty) {
    if (!xblToken) throw badRequest("Missing xblToken");
    if (!relyingParty) throw badRequest("Missing relyingParty");
    try {
        const { data } = await http.post("https://xsts.auth.xboxlive.com/xsts/authorize", { Properties: { SandboxId: "RETAIL", UserTokens: [xblToken] }, RelyingParty: relyingParty, TokenType: "JWT" });
        return data;
    } catch (err) {
        const payload = err.response?.data;
        const details = payload ? { status: err.response.status, xerr: payload.XErr, message: payload.Message, redirect: payload.Redirect, raw: payload } : err.message;
        throw internal("Failed to get XSTS token", details);
    }
}

export async function getProfileSettings(xuid, xboxliveToken, settings) {
    const url = `https://profile.xboxlive.com/users/xuid(${xuid})/profile/settings?settings=${encodeURIComponent(settings)}`;
    async function call(ver) {
        return http.get(url, { headers: { "x-xbl-contract-version": ver, Authorization: xboxliveToken } });
    }
    return cached(["profile", xuid, settings], async () => {
        try {
            const { data } = await call(3);
            return data;
        } catch (errV3) {
            const s = errV3.response?.status;
            if (s === 401 || s === 403) {
                throw internal("Failed to get profile settings", { status: s, body: errV3.response?.data || errV3.message });
            }
            try {
                const { data } = await call(2);
                return data;
            } catch (errV2) {
                throw internal("Failed to get profile settings", { status: errV2.response?.status, body: errV2.response?.data || errV2.message });
            }
        }
    }, 30000);
}

export async function getAchievements(xuid, xboxliveToken, { titleId } = {}) {
    try {
        const url = titleId ? `https://achievements.xboxlive.com/users/xuid(${xuid})/achievements?titleId=${encodeURIComponent(titleId)}` : `https://achievements.xboxlive.com/users/xuid(${xuid})/achievements`;
        const { data } = await http.get(url, { headers: { "x-xbl-contract-version": 2, Authorization: xboxliveToken } });
        return data;
    } catch (err) {
        throw internal("Failed to get achievements", err.response?.data || err.message);
    }
}

export async function getPresence(xuid, xboxliveToken) {
    return cached(["presence", xuid], async () => {
        try {
            const { data } = await http.get(`https://userpresence.xboxlive.com/users/xuid(${xuid})`, { headers: { "x-xbl-contract-version": 3, Authorization: xboxliveToken } });
            return data;
        } catch (err) {
            throw internal("Failed to get presence", err.response?.data || err.message);
        }
    }, 15000);
}

export async function getPresenceBatch(xuids = [], xboxliveToken) {
    const key = ["presence-batch", xuids.slice(0, 200).sort()];
    return cached(key, async () => {
        try {
            const { data } = await http.post("https://userpresence.xboxlive.com/users/batch", { xuids }, { headers: { "x-xbl-contract-version": 3, Authorization: xboxliveToken } });
            return data;
        } catch (err) {
            throw internal("Failed to get batch presence", err.response?.data || err.message);
        }
    }, 15000);
}

export async function getTitleHub(xuid, xboxliveToken, { fields = ["detail", "image", "scid", "achievement"], maxItems = 100, locale } = {}) {
    if (!xuid) throw badRequest("xuid is required");
    if (!xboxliveToken) throw badRequest("xboxliveToken is required");
    const fieldsStr = Array.isArray(fields) ? fields.join(",") : String(fields || "detail");
    const url = `https://titlehub.xboxlive.com/users/xuid(${xuid})/titles/titlehistory/decoration/${encodeURIComponent(fieldsStr)}?maxItems=${encodeURIComponent(maxItems)}`;
    const key = ["titlehub", xuid, fieldsStr, maxItems, locale || env.ACCEPT_LANGUAGE || "en-US"];
    return cached(key, async () => {
        try {
            const { data } = await http.get(url, { headers: { "x-xbl-contract-version": 2, Accept: "application/json", "Accept-Language": locale || env.ACCEPT_LANGUAGE || "en-US", Authorization: xboxliveToken } });
            return data;
        } catch (err) {
            const status = err.response?.status;
            if (status === 404) {
                return { titles: [], totalCount: 0, note: "No titles found (TitleHub returned 404)" };
            }
            throw internal("Failed to get titles (titlehub)", err.response?.data || err.message);
        }
    }, 30000);
}

export async function getXboxStats(xuid, xboxliveToken) {
    const url = "https://userstats.xboxlive.com/batch?operation=read";
    const body = {
        requestedusers: [xuid],
        requestedscids: [
            { scid: "00000000-0000-0000-0000-000073e3c5ef", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] },
            { scid: "00000000-0000-0000-0000-000067b57dac", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] },
            { scid: "00000000-0000-0000-0000-0000717d695f", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] },
            { scid: "00000000-0000-0000-0000-00006bf082d7", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] },
            { scid: "00000000-0000-0000-0000-0000639aa8dd", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] },
            { scid: "00000000-0000-0000-0000-00006cfa0c1e", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] },
            { scid: "4fc10100-5f7a-4470-899b-280835760c07", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] },
            { scid: "00000000-0000-0000-0000-00007a079e33", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] },
            { scid: "00000000-0000-0000-0000-000079dbee96", requestedstats: ["MinutesPlayed","BlockBrokenTotal","MobKilled.IsMonster.1","DistanceTravelled"] }
        ]
    };
    try {
        const { data } = await http.post(url, body, { headers: { Authorization: xboxliveToken, "Content-Type": "application/json; charset=utf-8", "x-xbl-contract-version": "1" } });
        return data;
    } catch (err) {
        throw internal("Failed to get xbox stats", err.response?.data || err.message);
    }
}

export async function resolveXuidByGamertag(gamertag, xboxliveToken) {
    if (!gamertag) throw badRequest("gamertag is required");
    try {
        const url = `https://profile.xboxlive.com/users/gt(${encodeURIComponent(gamertag)})/profile/settings?settings=Gamertag`;
        const { data } = await http.get(url, { headers: { "x-xbl-contract-version": 2, Authorization: xboxliveToken } });
        const u = data?.profileUsers?.[0];
        return u?.id || null;
    } catch (err) {
        throw internal("Failed to resolve XUID by gamertag", err.response?.data || err.message);
    }
}

export async function resolveGamertagByXuid(xuid, xboxliveToken) {
    if (!xuid) throw badRequest("xuid is required");
    try {
        const data = await getProfileSettings(xuid, xboxliveToken, "Gamertag");
        const u = data?.profileUsers?.[0];
        const setting = u?.settings?.find(s => s.id === "Gamertag");
        return setting?.value || null;
    } catch (err) {
        throw internal("Failed to resolve gamertag by XUID", err.response?.data || err.message);
    }
}

export async function getPeople(xboxliveToken, maxItems = 200) {
    try {
        const url = `https://peoplehub.xboxlive.com/users/me/people?maxItems=${encodeURIComponent(maxItems)}`;
        const { data } = await http.get(url, { headers: { "x-xbl-contract-version": 3, Authorization: xboxliveToken } });
        return data;
    } catch (err) {
        throw internal("Failed to get people", err.response?.data || err.message);
    }
}

export async function getGameClips(xuid, xboxliveToken, { titleId, max = 24, since, continuationToken } = {}) {
    const params = new URLSearchParams();
    params.set("maxItems", String(max));
    if (titleId) params.set("titleId", String(titleId));
    if (since) params.set("startDate", new Date(since).toISOString());
    if (continuationToken) params.set("continuationToken", continuationToken);
    const url = `https://gameclipsmetadata.xboxlive.com/users/xuid(${xuid})/clips?${params.toString()}`;
    try {
        const { data } = await http.get(url, { headers: { "x-xbl-contract-version": 2, Authorization: xboxliveToken } });
        return data;
    } catch (err) {
        throw internal("Failed to get game clips", err.response?.data || err.message);
    }
}

export async function getXuidByGamertag(gamertag, xboxliveToken) {
    if (!gamertag) throw badRequest("gamertag is required");
    const url = `https://profile.xboxlive.com/users/gt(${encodeURIComponent(gamertag)})/profile/settings?settings=Gamertag`;
    const call = ver => http.get(url, { headers: { "x-xbl-contract-version": ver, Authorization: xboxliveToken } });
    const key = ["xuidByGamertag", gamertag.toLowerCase()];
    return cached(key, async () => {
        try {
            const { data } = await call(3);
            return data?.profileUsers?.[0]?.id || null;
        } catch (eV3) {
            const s = eV3.response?.status;
            if (s === 404 || s === 204) return null;
            try {
                const { data } = await call(2);
                return data?.profileUsers?.[0]?.id || null;
            } catch (eV2) {
                const s2 = eV2.response?.status;
                if (s2 === 404 || s2 === 204) return null;
                throw internal("Failed to lookup XUID by gamertag", eV2.response?.data || eV2.message);
            }
        }
    }, 30000);
}

export async function getGamertagByXuid(xuid, xboxliveToken) {
    const key = ["gamertagByXuid", xuid];
    return cached(key, async () => {
        const data = await getProfileSettings(xuid, xboxliveToken, "Gamertag");
        const settings = data?.profileUsers?.[0]?.settings || [];
        const gt = settings.find(s => s.id === "Gamertag")?.value;
        return gt || null;
    }, 30000);
}

export async function getScreenshots(xuid, xboxliveToken, { titleId, max = 24, since, continuationToken } = {}) {
    const params = new URLSearchParams();
    params.set("maxItems", String(max));
    if (titleId) params.set("titleId", String(titleId));
    if (since) params.set("startDate", new Date(since).toISOString());
    if (continuationToken) params.set("continuationToken", continuationToken);
    const url = `https://screenshotsmetadata.xboxlive.com/users/xuid(${xuid})/screenshots?${params.toString()}`;
    try {
        const { data } = await http.get(url, { headers: { "x-xbl-contract-version": 2, Authorization: xboxliveToken } });
        return data;
    } catch (err) {
        throw internal("Failed to get screenshots", err.response?.data || err.message);
    }
}
