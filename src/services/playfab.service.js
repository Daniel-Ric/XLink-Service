import { env } from "../config/env.js";
import { internal, badRequest } from "../utils/httpError.js";
import { createHttp } from "../utils/http.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);

export async function loginWithXbox(xstsToken, titleId = env.PLAYFAB_TITLE_ID) {
    if (!titleId) throw badRequest("PLAYFAB_TITLE_ID missing. Set it in .env");
    const baseUrl = `https://${titleId}.playfabapi.com/Client/LoginWithXbox`;
    try {
        const { data } = await http.post(baseUrl, { TitleId: titleId, XboxToken: xstsToken, CreateAccount: true, InfoRequestParameters: { GetUserAccountInfo: true } }, { headers: { "Content-Type": "application/json", Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to login with Xbox (PlayFab)", err.response?.data || err.message);
    }
}

export async function getEntityToken(sessionTicket, entity) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Authentication/GetEntityToken`;
    try {
        const { data } = await http.post(url, entity ? { Entity: entity } : {}, { headers: { "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to get PlayFab EntityToken", err.response?.data || err.message);
    }
}

export async function getPlayFabInventory(entityToken, entityId, entityType = "title_player_account", collectionId = "default", count = 50) {
    if (!entityToken || !entityId) throw badRequest("entityToken and entityId are required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Inventory/GetInventoryItems`;
    try {
        const { data } = await http.post(url, { Entity: { Type: entityType, Id: entityId }, CollectionId: collectionId, Count: count }, { headers: { "Content-Type": "application/json", "X-EntityToken": entityToken, Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to get PlayFab inventory", err.response?.data || err.message);
    }
}

export async function getPlayFabAccountInfo(sessionTicket) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetAccountInfo`;
    try {
        const { data } = await http.post(url, {}, { headers: { "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to get PlayFab account info", err.response?.data || err.message);
    }
}

export async function getPlayFabPlayerProfile(sessionTicket, playFabId) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetPlayerProfile`;
    try {
        const body = playFabId ? { PlayFabId: playFabId } : {};
        const { data } = await http.post(url, body, { headers: { "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to get PlayFab player profile", err.response?.data || err.message);
    }
}

export async function getPlayFabCatalog(sessionTicket, catalogVersion) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetCatalogItems`;
    try {
        const { data } = await http.post(url, catalogVersion ? { CatalogVersion: catalogVersion } : {}, { headers: { "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to get PlayFab catalog", err.response?.data || err.message);
    }
}

export async function getPlayFabTitleData(sessionTicket, keys) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetTitleData`;
    try {
        const { data } = await http.post(url, keys?.length ? { Keys: keys } : {}, { headers: { "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to get PlayFab title data", err.response?.data || err.message);
    }
}

export async function getPlayFabUserData(sessionTicket, keys, playFabId) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetUserData`;
    try {
        const body = {};
        if (Array.isArray(keys) && keys.length) body.Keys = keys;
        if (playFabId) body.PlayFabId = playFabId;
        const { data } = await http.post(url, body, { headers: { "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to get PlayFab user data", err.response?.data || err.message);
    }
}

export async function getPlayFabUserReadOnlyData(sessionTicket, keys, playFabId) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetUserReadOnlyData`;
    try {
        const body = {};
        if (Array.isArray(keys) && keys.length) body.Keys = keys;
        if (playFabId) body.PlayFabId = playFabId;
        const { data } = await http.post(url, body, { headers: { "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json" } });
        return data.data;
    } catch (err) {
        throw internal("Failed to get PlayFab read-only user data", err.response?.data || err.message);
    }
}
