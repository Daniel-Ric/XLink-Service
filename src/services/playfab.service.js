import {env} from "../config/env.js";
import {badRequest, forbidden, internal, unauthorized} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";

const http = createHttp(env.HTTP_TIMEOUT_MS);

export async function loginWithXbox(xstsToken, titleId = env.PLAYFAB_TITLE_ID) {
    if (!titleId) throw badRequest("PLAYFAB_TITLE_ID missing. Set it in .env");
    const baseUrl = `https://${titleId}.playfabapi.com/Client/LoginWithXbox`;
    try {
        const {data} = await http.post(baseUrl, {
            TitleId: titleId,
            XboxToken: xstsToken,
            CreateAccount: true,
            InfoRequestParameters: {GetUserAccountInfo: true}
        }, {headers: {"Content-Type": "application/json", Accept: "application/json"}});
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to login with Xbox (PlayFab)", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to login with Xbox (PlayFab)", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to login with Xbox (PlayFab)", detail);
        }
        throw internal("Failed to login with Xbox (PlayFab)", detail);
    }
}

export async function getEntityToken(sessionTicket, entity) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Authentication/GetEntityToken`;
    try {
        const {data} = await http.post(url, entity ? {Entity: entity} : {}, {
            headers: {
                "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json"
            }
        });
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to get PlayFab EntityToken", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get PlayFab EntityToken", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to get PlayFab EntityToken", detail);
        }
        throw internal("Failed to get PlayFab EntityToken", detail);
    }
}

export async function getPlayFabInventory(entityToken, entityId, entityType = "title_player_account", collectionId = "default", count = 50) {
    if (!entityToken || !entityId) throw badRequest("entityToken and entityId are required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Inventory/GetInventoryItems`;
    try {
        const {data} = await http.post(url, {
            Entity: {Type: entityType, Id: entityId}, CollectionId: collectionId, Count: count
        }, {headers: {"Content-Type": "application/json", "X-EntityToken": entityToken, Accept: "application/json"}});
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to get PlayFab inventory", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get PlayFab inventory", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to get PlayFab inventory", detail);
        }
        throw internal("Failed to get PlayFab inventory", detail);
    }
}

export async function getPlayFabAccountInfo(sessionTicket) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetAccountInfo`;
    try {
        const {data} = await http.post(url, {}, {
            headers: {
                "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json"
            }
        });
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to get PlayFab account info", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get PlayFab account info", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to get PlayFab account info", detail);
        }
        throw internal("Failed to get PlayFab account info", detail);
    }
}

export async function getPlayFabPlayerProfile(sessionTicket, playFabId) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetPlayerProfile`;
    try {
        const body = playFabId ? {PlayFabId: playFabId} : {};
        const {data} = await http.post(url, body, {
            headers: {
                "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json"
            }
        });
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to get PlayFab player profile", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get PlayFab player profile", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to get PlayFab player profile", detail);
        }
        throw internal("Failed to get PlayFab player profile", detail);
    }
}

export async function getPlayFabCatalog(sessionTicket, catalogVersion) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetCatalogItems`;
    try {
        const {data} = await http.post(url, catalogVersion ? {CatalogVersion: catalogVersion} : {}, {
            headers: {
                "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json"
            }
        });
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to get PlayFab catalog", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get PlayFab catalog", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to get PlayFab catalog", detail);
        }
        throw internal("Failed to get PlayFab catalog", detail);
    }
}

export async function getPlayFabTitleData(sessionTicket, keys) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetTitleData`;
    try {
        const {data} = await http.post(url, keys?.length ? {Keys: keys} : {}, {
            headers: {
                "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json"
            }
        });
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to get PlayFab title data", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get PlayFab title data", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to get PlayFab title data", detail);
        }
        throw internal("Failed to get PlayFab title data", detail);
    }
}

export async function getPlayFabUserData(sessionTicket, keys, playFabId) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetUserData`;
    try {
        const body = {};
        if (Array.isArray(keys) && keys.length) body.Keys = keys;
        if (playFabId) body.PlayFabId = playFabId;
        const {data} = await http.post(url, body, {
            headers: {
                "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json"
            }
        });
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to get PlayFab user data", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get PlayFab user data", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to get PlayFab user data", detail);
        }
        throw internal("Failed to get PlayFab user data", detail);
    }
}

export async function getPlayFabUserReadOnlyData(sessionTicket, keys, playFabId) {
    if (!sessionTicket) throw badRequest("sessionTicket is required");
    const url = `https://${env.PLAYFAB_TITLE_ID}.playfabapi.com/Client/GetUserReadOnlyData`;
    try {
        const body = {};
        if (Array.isArray(keys) && keys.length) body.Keys = keys;
        if (playFabId) body.PlayFabId = playFabId;
        const {data} = await http.post(url, body, {
            headers: {
                "Content-Type": "application/json", "X-Authorization": sessionTicket, Accept: "application/json"
            }
        });
        return data.data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message;
        if (status === 401) {
            throw unauthorized("Failed to get PlayFab read-only user data", detail);
        }
        if (status === 403) {
            throw forbidden("Failed to get PlayFab read-only user data", detail);
        }
        if (status && status >= 400 && status < 500) {
            throw badRequest("Failed to get PlayFab read-only user data", detail);
        }
        throw internal("Failed to get PlayFab read-only user data", detail);
    }
}
