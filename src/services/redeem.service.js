import {env} from "../config/env.js";
import {badRequest, forbidden, internal, unauthorized} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";

const REDEEM_BASE = "https://buynow.production.store-web.dynamics.com/v1.0/Redeem";
const APP_ID = "RedeemNow";

const http = createHttp(env.HTTP_TIMEOUT_MS);

const EXACT_FLIGHTS = ["sc_reactredeem,sc_reactredeemv2,sc_redeemcontainer,sc_minecraftredeem", "sc_abandonedretry", "sc_addasyncpitelemetry", "sc_adddatapropertyiap", "sc_addgifteeduringordercreation", "sc_aemparamforimage", "sc_aienabledversusairestricted", "sc_allowalipayforcheckout", "sc_allowapplepay", "sc_allowbuynowrupay", "sc_allowcustompifiltering", "sc_allowelo", "sc_allowfincastlerewardsforsubs", "sc_allowgooglepay", "sc_allowmpesapi", "sc_allowparallelorderload", "sc_allowpaypay", "sc_allowpaypayforcheckout", "sc_allowpaysafecard", "sc_allowrupay", "sc_allowrupayforcheckout", "sc_allowsmdmarkettobeprimarypi", "sc_allowupi", "sc_allowupiforbuynow", "sc_allowupiforcheckout", "sc_allowupiqr", "sc_allowupiqrforbuynow", "sc_allowupiqrforcheckout", "sc_allowvenmo", "sc_allowvenmoforbuynow", "sc_allowvenmoforcheckout", "sc_allowverve", "sc_analyticsforbuynow", "sc_announcefatalerror", "sc_apperrorboundarytsenabled", "sc_askaparentinsufficientbalance", "sc_askaparenttsenabled", "sc_asyncpiurlupdate", "sc_asyncpurchasefailure", "sc_asyncpurchasefailurexboxcom", "sc_authactionts", "sc_autorenewalconsentnarratorfix", "sc_bankchallenge", "sc_bankchallengecheckout", "sc_blockcsvpurchasefrombuynow", "sc_blocklegacyupgrade", "sc_buynowfocustrapkeydown", "sc_buynowglobalpiadd", "sc_buynowlistpichanges", "sc_buynowuipreload", "sc_cancelorderwithstatusdefault", "sc_captureincompleteiapsdata", "sc_captureiapsuserinfo", "sc_carrierbillingcheckout", "sc_carrierbillingpayment", "sc_cartselectionevents", "sc_changeauthprovidernameinexperiments", "sc_checkoutflowoverride", "sc_checkoutpageaddmemfix", "sc_checkoutpagealternateflow", "sc_checkoutpagecallcart", "sc_checkoutpagecallfromcart", "sc_checkoutpageloadfrombuy", "sc_checkoutpageloadfrombuynow", "sc_checkoutpageloadfromgift", "sc_checkoutpageloadfromprice", "sc_checkoutpageloadfromproduct", "sc_checkoutpageloadfrompromo", "sc_checkoutpageloadfromredeem", "sc_checkoutpageloadfromwishlist", "sc_checkoutpageredirecttocart", "sc_checkoutpageshowredeemcode", "sc_checkoutpageswitchtocheckout", "sc_checkoutpifixtoken", "sc_checkoutpiiframefix", "sc_checkoutpireducespinner", "sc_checkoutpostorderactions", "sc_checkoutpostorderactionsfix", "sc_checkoutpostorderactionsfixpart2", "sc_checkoutpostorderactionsfixpart3", "sc_checkoutpostorderactionsfixpart4", "sc_checkoutpostorderactionsfixpart5", "sc_checkoutpostorderactionsfixpart6", "sc_checkoutpostorderactionsfixpart7", "sc_checkoutpostorderactionsfixpart8", "sc_checkoutpostorderactionsfixpart9", "sc_checkoutpricetokenfix", "sc_checkoutpricetokenfix2", "sc_checkoutpricetokenfix3", "sc_checkoutpricetokenfix4", "sc_checkoutpricetokenfix5", "sc_checkoutpricetokenfix6", "sc_checkoutpricetokenfix7", "sc_checkoutpricetokenfix8", "sc_checkoutpricetokenfix9", "sc_checkoutpricetokenfix10", "sc_checkoutpricetokenfix11", "sc_checkoutpricetokenfix12", "sc_checkoutpricetokenfix13", "sc_checkoutpricetokenfix14", "sc_checkoutpricetokenfix15", "sc_checkoutpricetokenfix16", "sc_checkoutpricetokenfix17", "sc_checkoutpricetokenfix18", "sc_checkoutpricetokenfix19", "sc_checkoutpricetokenfix20", "sc_checkoutpricetokenfix21", "sc_checkoutpricetokenfix22", "sc_checkoutpricetokenfix23", "sc_checkoutpricetokenfix24", "sc_checkoutpricetokenfix25", "sc_checkoutpricetokenfix26", "sc_checkoutpricetokenfix27", "sc_checkoutpricetokenfix28", "sc_checkoutpricetokenfix29", "sc_checkoutpricetokenfix30", "sc_checkoutpricetokenfix31", "sc_checkoutpricetokenfix32", "sc_checkoutpricetokenfix33", "sc_checkoutpricetokenfix34", "sc_checkoutpricetokenfix35", "sc_checkoutpricetokenfix36", "sc_checkoutpricetokenfix37", "sc_checkoutpricetokenfix38", "sc_checkoutpricetokenfix39", "sc_checkoutpricetokenfix40", "sc_checkoutpricetokenfix41", "sc_checkoutpricetokenfix42", "sc_checkoutpricetokenfix43", "sc_checkoutpricetokenfix44", "sc_checkoutpricetokenfix45", "sc_checkoutpricetokenfix46", "sc_checkoutpricetokenfix47", "sc_checkoutpricetokenfix48", "sc_checkoutpricetokenfix49", "sc_checkoutpricetokenfix50", "sc_checkoutpricetokenfix51", "sc_checkoutpricetokenfix52", "sc_checkoutpricetokenfix53", "sc_checkoutpricetokenfix54", "sc_checkoutpricetokenfix55", "sc_checkoutpricetokenfix56", "sc_checkoutpricetokenfix57", "sc_checkoutpricetokenfix58", "sc_checkoutpricetokenfix59", "sc_checkoutpricetokenfix60", "sc_checkoutpricetokenfix61", "sc_checkoutpricetokenfix62", "sc_checkoutpricetokenfix63", "sc_checkoutpricetokenfix64", "sc_checkoutpricetokenfix65", "sc_checkoutpricetokenfix66", "sc_checkoutpricetokenfix67", "sc_checkoutpricetokenfix68", "sc_checkoutpricetokenfix69", "sc_checkoutpricetokenfix70", "sc_checkoutpricetokenfix71", "sc_checkoutpricetokenfix72", "sc_checkoutpricetokenfix73", "sc_checkoutpricetokenfix74", "sc_checkoutpricetokenfix75", "sc_checkoutpricetokenfix76", "sc_checkoutpricetokenfix77", "sc_checkoutpricetokenfix78", "sc_checkoutpricetokenfix79", "sc_checkoutpricetokenfix80", "sc_checkoutpricetokenfix81", "sc_checkoutpricetokenfix82", "sc_checkoutpricetokenfix83", "sc_checkoutpricetokenfix84", "sc_checkoutpricetokenfix85", "sc_checkoutpricetokenfix86", "sc_checkoutpricetokenfix87", "sc_checkoutpricetokenfix88", "sc_checkoutpricetokenfix89", "sc_checkoutpricetokenfix90", "sc_checkoutpricetokenfix91", "sc_checkoutpricetokenfix92", "sc_checkoutpricetokenfix93", "sc_checkoutpricetokenfix94", "sc_checkoutpricetokenfix95", "sc_checkoutpricetokenfix96", "sc_checkoutpricetokenfix97", "sc_checkoutpricetokenfix98", "sc_checkoutpricetokenfix99", "sc_checkoutpricetokenfix100", "sc_checkoutpricetokenfix101", "sc_checkoutpricetokenfix102", "sc_checkoutpricetokenfix103", "sc_checkoutpricetokenfix104", "sc_checkoutpricetokenfix105", "sc_checkoutpricetokenfix106", "sc_checkoutpricetokenfix107", "sc_checkoutpricetokenfix108", "sc_checkoutpricetokenfix109", "sc_checkoutpricetokenfix110", "sc_checkoutpricetokenfix111", "sc_checkoutpricetokenfix112", "sc_checkoutpricetokenfix113", "sc_checkoutpricetokenfix114", "sc_checkoutpricetokenfix115", "sc_checkoutpricetokenfix116", "sc_checkoutpricetokenfix117", "sc_checkoutpricetokenfix118", "sc_checkoutpricetokenfix119", "sc_checkoutpricetokenfix120", "sc_checkoutpricetokenfix121", "sc_checkoutpricetokenfix122", "sc_checkoutpricetokenfix123", "sc_checkoutpricetokenfix124", "sc_checkoutpricetokenfix125", "sc_checkoutpricetokenfix126", "sc_checkoutpricetokenfix127", "sc_checkoutpricetokenfix128", "sc_checkoutpricetokenfix129", "sc_checkoutpricetokenfix130", "sc_checkoutpricetokenfix131", "sc_checkoutpricetokenfix132", "sc_checkoutpricetokenfix133", "sc_checkoutpricetokenfix134", "sc_checkoutpricetokenfix135", "sc_checkoutpricetokenfix136", "sc_checkoutpricetokenfix137", "sc_checkoutpricetokenfix138", "sc_checkoutpricetokenfix139", "sc_checkoutpricetokenfix140", "sc_checkoutpricetokenfix141", "sc_checkoutpricetokenfix142", "sc_checkoutpricetokenfix143", "sc_checkoutpricetokenfix144", "sc_checkoutpricetokenfix145", "sc_checkoutpricetokenfix146", "sc_checkoutpricetokenfix147", "sc_checkoutpricetokenfix148", "sc_checkoutpricetokenfix149", "sc_checkoutpricetokenfix150", "sc_checkoutpricetokenfix151", "sc_checkoutpricetokenfix152", "sc_checkoutpricetokenfix153", "sc_checkoutpricetokenfix154", "sc_checkoutpricetokenfix155", "sc_checkoutpricetokenfix156", "sc_checkoutpricetokenfix157", "sc_checkoutpricetokenfix158", "sc_checkoutpricetokenfix159", "sc_checkoutpricetokenfix160", "sc_checkoutpricetokenfix161", "sc_checkoutpricetokenfix162", "sc_checkoutpricetokenfix163", "sc_checkoutpricetokenfix164", "sc_checkoutpricetokenfix165", "sc_checkoutpricetokenfix166", "sc_checkoutpricetokenfix167", "sc_checkoutpricetokenfix168", "sc_checkoutpricetokenfix169", "sc_checkoutpricetokenfix170", "sc_checkoutpricetokenfix171", "sc_checkoutpricetokenfix172", "sc_checkoutpricetokenfix173", "sc_checkoutpricetokenfix174", "sc_checkoutpricetokenfix175", "sc_checkoutpricetokenfix176", "sc_checkoutpricetokenfix177", "sc_checkoutpricetokenfix178", "sc_checkoutpricetokenfix179", "sc_checkoutpricetokenfix180", "sc_checkoutpricetokenfix181", "sc_checkoutpricetokenfix182", "sc_checkoutpricetokenfix183", "sc_checkoutpricetokenfix184", "sc_checkoutpricetokenfix185", "sc_checkoutpricetokenfix186", "sc_checkoutpricetokenfix187", "sc_checkoutpricetokenfix188", "sc_checkoutpricetokenfix189", "sc_checkoutpricetokenfix190", "sc_checkoutpricetokenfix191", "sc_checkoutpricetokenfix192", "sc_checkoutpricetokenfix193", "sc_checkoutpricetokenfix194", "sc_checkoutpricetokenfix195", "sc_checkoutpricetokenfix196", "sc_checkoutpricetokenfix197", "sc_checkoutpricetokenfix198", "sc_checkoutpricetokenfix199", "sc_checkoutpricetokenfix200", "sc_checkoutpricetokenfix201", "sc_checkoutpricetokenfix202", "sc_checkoutpricetokenfix203", "sc_upgradeconsentnonrenewing", "sc_usefullminimaluhf", "sc_useresellernamestring", "sc_uuid", "sc_validaterequestfields400", "sc_xboxcomnosapi", "sc_xboxrecofix", "sc_xboxredirection", "sc_xdlshipbuffer"];

function normalizeMarket(market) {
    const m = String(market || "").trim().toUpperCase();
    return m || "US";
}

function normalizeLocale(locale) {
    const raw = String(locale || "").trim();
    if (!raw) return "en-US";
    const first = raw.split(",")[0].trim();
    return first || "en-US";
}

function buildHeaders(redeemToken, flow, msCv) {
    if (!redeemToken) throw badRequest("redeemToken is required");

    return {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": flow?.acceptLanguage || "en-US",
        Authorization: redeemToken,
        Connection: "keep-alive",
        "Content-Type": "application/json",
        "MS-CV": msCv,
        Origin: "https://www.microsoft.com",
        Referer: "https://www.microsoft.com/",
        "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "X-Authorization-Muid": flow?.muid,
        "X-MS-Client-Type": "MinecraftNet",
        "X-MS-Correlation-ID": flow?.correlationId,
        "X-MS-Market": normalizeMarket(flow?.market),
        "x-MS-Reference-Id": flow?.referenceId,
        "x-MS-Tracking-Id": flow?.trackingId,
        "X-MS-Vector-Id": flow?.vectorId
    };
}

export async function prepareRedeem(redeemToken, {code, market, locale} = {}, flow = {}) {
    if (!code || typeof code !== "string") throw badRequest("code is required");

    const url = `${REDEEM_BASE}/PrepareRedeem?appId=${encodeURIComponent(APP_ID)}&context=LookupToken`;

    const m = normalizeMarket(market);
    const lang = normalizeLocale(locale);

    const f = {
        ...flow, market: m
    };

    const payload = {
        market: m,
        language: lang,
        flights: EXACT_FLIGHTS,
        tokenIdentifierValue: code.trim(),
        supportsCsvTypeTokenOnly: false,
        buyNowScenario: "redeem",
        clientContext: {
            client: "MinecraftNet", deviceFamily: "Web"
        }
    };

    const msCv = `${String(f.cvBase || "FIzDSTrg7TZ2naZyEL1T/P")}.0.3`;

    try {
        const {data} = await http.post(url, payload, {headers: buildHeaders(redeemToken, f, msCv)});
        return data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) throw unauthorized("Failed to lookup redeem token", detail);
        if (status === 403) throw forbidden("Failed to lookup redeem token", detail);
        throw internal("Failed to lookup redeem token", detail);
    }
}

export async function redeemCode(redeemToken, {code, paymentSessionId, market, locale} = {}, flow = {}) {
    if (!code || typeof code !== "string") throw badRequest("code is required");
    if (!paymentSessionId || typeof paymentSessionId !== "string") throw badRequest("paymentSessionId is required");

    const url = `${REDEEM_BASE}/RedeemToken?appId=${encodeURIComponent(APP_ID)}`;

    const m = normalizeMarket(market);
    const loc = normalizeLocale(locale);

    const f = {
        ...flow, market: m
    };

    const payload = {
        market: m, locale: loc, flights: EXACT_FLIGHTS, clientContext: {
            client: "MinecraftNet", deviceFamily: "Web"
        }, buyNowScenario: "redeem", paymentInstrumentId: code.trim(), paymentSessionId, refreshPaymentInstrument: true
    };

    const msCv = `${String(f.cvBase || "FIzDSTrg7TZ2naZyEL1T/P")}.0.4`;

    try {
        const {data} = await http.post(url, payload, {headers: buildHeaders(redeemToken, f, msCv)});
        return data;
    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data || err.message || err;
        if (status === 401) throw unauthorized("Failed to redeem code", detail);
        if (status === 403) throw forbidden("Failed to redeem code", detail);
        throw internal("Failed to redeem code", detail);
    }
}
