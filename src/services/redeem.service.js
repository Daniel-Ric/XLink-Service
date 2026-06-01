import {env} from "../config/env.js";
import {HttpError, badRequest, forbidden, internal, unauthorized} from "../utils/httpError.js";
import {createHttp} from "../utils/http.js";

const REDEEM_BASE = "https://buynow.production.store-web.dynamics.com/v1.0/Redeem";
const APP_ID = "RedeemNow";

const http = createHttp(env.HTTP_TIMEOUT_MS);

const EXACT_FLIGHTS = ["sc_reactredeem,sc_reactredeemv2,sc_redeemcontainer,sc_minecraftredeem", "sc_abandonedretry", "sc_addasyncpitelemetry", "sc_adddatapropertyiap", "sc_addgifteeduringordercreation", "sc_aemparamforimage", "sc_aienabledversusairestricted", "sc_allowalipayforcheckout", "sc_allowapplepay", "sc_allowbuynowrupay", "sc_allowcustompifiltering", "sc_allowelo", "sc_allowfincastlerewardsforsubs", "sc_allowgooglepay", "sc_allowmpesapi", "sc_allowparallelorderload", "sc_allowpaypay", "sc_allowpaypayforcheckout", "sc_allowpaysafecard", "sc_allowrupay", "sc_allowrupayforcheckout", "sc_allowsmdmarkettobeprimarypi", "sc_allowupi", "sc_allowupiforbuynow", "sc_allowupiforcheckout", "sc_allowupiqr", "sc_allowupiqrforbuynow", "sc_allowupiqrforcheckout", "sc_allowvenmo", "sc_allowvenmoforbuynow", "sc_allowvenmoforcheckout", "sc_allowverve", "sc_analyticsforbuynow", "sc_announcefatalerror", "sc_announceprice", "sc_apperrorboundarytsenabled", "sc_askaparentinsufficientbalance", "sc_askaparenttsenabled", "sc_asyncpiurlupdate", "sc_asyncpurchasefailure", "sc_asyncpurchasefailurexboxcom", "sc_authactionts", "sc_autorenewalconsentnarratorfix", "sc_bankchallenge", "sc_bankchallengecheckout", "sc_blockcsvpurchasefrombuynow", "sc_blocklegacyupgrade", "sc_buynowfocustrapkeydown", "sc_buynowglobalpiadd", "sc_buynowlistpichanges", "sc_buynowsubscriptionlegalterms", "sc_buynowuipreload", "sc_buynowuiprod", "sc_cartcofincastle", "sc_cartcopaymentoptioncssrefactor", "sc_cawarrantytermsv2", "sc_checkoutglobalpiadd", "sc_checkoutitemfontweight", "sc_checkoutredeem", "sc_clientdebuginfo", "sc_clienttelemetryforceenabled", "sc_clienttorequestorid", "sc_commercialcheckout", "sc_conditionalprepareredeempaymentmethods", "sc_contactpreferenceactionts", "sc_contactpreferenceupdate", "sc_contactpreferenceupdatexboxcom", "sc_controllerscrollenabled", "sc_conversionblockederror", "sc_copycurrentcart", "sc_cpdeclinedv2", "sc_decomposeproductdetails", "sc_delayretry", "sc_deprecatesubscriptionprice", "sc_devicerepairpifilter", "sc_digitallicenseterms", "sc_disableupgradetrycheckout", "sc_eligibilityapi", "sc_emptyresultcheck", "sc_enablecartcreationerrorparsing", "sc_enablekakaopay", "sc_errorpageviewfix", "sc_errorstringsts", "sc_euomnibusprice", "sc_expandedpaymentmethodswithlogos", "sc_expandedpurchasespinner", "sc_expresscheckoutpaymentinstrumentinfo", "sc_extendpagetagtooverride", "sc_fatalerrorfirstbuttonfocus", "sc_fetchlivepersonfromparentwindow", "sc_fincastlebuynowallowlist", "sc_fincastlebuynowv2strings", "sc_fincastlecalculation", "sc_fincastlecallerapplicationidcheck", "sc_fincastleui", "sc_fingerprinttagginglazyload", "sc_fixredeemautorenew", "sc_flexibleoffers", "sc_flexsubs", "sc_fullpagespinnerfix", "sc_gamepadfix", "sc_gamepadscrollsmarttv", "sc_gcodetailsentity", "sc_giftingtelemetryfix", "sc_giftlabelsupdate", "sc_globalhidecssphonenumber", "sc_greenshipping", "sc_handledccemptyresponse", "sc_hideredeemclient", "sc_hidesubscriptionprice", "sc_hipercard", "sc_imagelazyload", "sc_inlineshippingselectormsa", "sc_inlinetempfix", "sc_inputplaceholder", "sc_isaskaparentstringsv2", "sc_isremovesubardigitalattach", "sc_jarvisconsumerprofile", "sc_klarna", "sc_lineitemactionts", "sc_livepersonlistener", "sc_loadingspinner", "sc_lowbardiscountmap", "sc_mapinapppostdata", "sc_marketswithmigratingcssphonenumber", "sc_microsoftpremiuminstruction", "sc_microsoftpremiuminstructionstring", "sc_moraystyle", "sc_moraystyledevicerepair", "sc_narratoraddress", "sc_newcheckoutselectorforxboxcom", "sc_newconversionurl", "sc_newflexiblepaymentsmessage", "sc_newrecoprod", "sc_noawaitforupdateordercall", "sc_norcalifornialaw", "sc_norcalifornialawlog", "sc_norcalifornialawstate", "sc_officescds", "sc_optionalcatalogclienttype", "sc_ordercheckoutfix", "sc_orderpisyncdisabled", "sc_outofstock", "sc_passthroughculture", "sc_paymentmethodchangepifix", "sc_paymentoptionnotfound", "sc_paymentsessioninsummarypage", "sc_perpetualpass", "sc_pidlignoreesckey", "sc_pitelemetryupdates", "sc_postpurchasedatatosva", "sc_preloadpidlcontainerts", "sc_productimageoptimization", "sc_prominenteddchange", "sc_promocode", "sc_promocodecheckout", "sc_purchaseblock", "sc_purchaseblockerrorhandling", "sc_purchasedblocked", "sc_purchasedblockedby", "sc_pxenablesubheadingfordisplayhint", "sc_quantitycap", "sc_railv2", "sc_reactcheckout", "sc_readytopurchasefix", "sc_redeemfocusforce", "sc_redeemstoreappv2", "sc_reloadiflineitemdiscrepancy", "sc_removeresellerforstoreapp", "sc_resellerdetail", "sc_restoregiftfieldlimits", "sc_returnoospsatocart", "sc_routechangemessagetoxboxcom", "sc_rspv2", "sc_scenariotelemetryrefactor", "sc_selectcontrol", "sc_setbehaviordefaultvalue", "sc_shippingallowlist", "sc_showcontactsupportlink", "sc_skippurchaseconfirm", "sc_skipselectpi", "sc_smarttvforcefullgamepadlibrary", "sc_smarttvlegaltermsfocusfix", "sc_splipidltresourcehelper", "sc_splittaxv2", "sc_staticassetsimport", "sc_surveyurlv2", "sc_termidinaddlineitems", "sc_testflight", "sc_typofixforrealtimepayments", "sc_updateallowedpaymentmethodstoadd", "sc_updatebillinginfo", "sc_updatedcontactpreferencemarkets", "sc_updatetosubscriptionpricev2", "sc_updatewarrantycompletesurfaceproinlinelegalterm", "sc_updatewarrantytermslink", "sc_usecommonpaymentfilteringlogic", "sc_usefullminimaluhf", "sc_useresellernamestring", "sc_uuid", "sc_vsbsubscriptionlegalterms", "sc_xboxcomnosapi", "sc_xboxrecofix", "sc_xboxredirection", "sc_xboxvirtualkeyboardhandler", "sc_xdlshipbuffer"];
const DEFAULT_CV_BASE = "KxTJT1WHsXNfQa9tF0zyhc";
const DEFAULT_SEC_CH_UA = "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

function normalizeMarket(market, locale) {
    const m = String(market || "").trim().toUpperCase();
    if (m) return m;

    const raw = String(locale || "").trim();
    const match = raw.match(/[-_]([A-Za-z]{2})\b/);
    return match ? match[1].toUpperCase() : "US";
}

function normalizeLocale(locale) {
    const raw = String(locale || "").trim();
    if (!raw) return "en-US";
    const first = raw.split(",")[0].trim();
    return first || "en-US";
}

function normalizeCode(code) {
    return String(code || "").replace(/\s+/g, "").trim();
}

function normalizeFlights(flights) {
    if (Array.isArray(flights)) {
        const normalized = flights.map(f => String(f || "").trim()).filter(Boolean);
        return normalized.length ? normalized : null;
    }

    if (typeof flights === "string" && flights.trim()) {
        try {
            return normalizeFlights(JSON.parse(flights));
        } catch {
            return null;
        }
    }

    return null;
}

function resolveFlights(flow) {
    return normalizeFlights(flow?.flights) || normalizeFlights(env.REDEEM_FLIGHTS_JSON) || EXACT_FLIGHTS;
}

function buildHeaders(redeemToken, flow, msCv) {
    if (!redeemToken) throw badRequest("redeemToken is required");

    const headers = {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": flow?.acceptLanguage || "en-US",
        Authorization: redeemToken,
        Connection: "keep-alive",
        "Content-Type": "application/json",
        "MS-CV": msCv,
        Origin: "https://www.microsoft.com",
        Referer: "https://www.microsoft.com/",
        "sec-ch-ua": flow?.secChUa || env.REDEEM_SEC_CH_UA || DEFAULT_SEC_CH_UA,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "User-Agent": flow?.userAgent || env.REDEEM_USER_AGENT || DEFAULT_USER_AGENT,
        "X-Authorization-Muid": flow?.muid,
        "X-MS-Client-Type": flow?.clientType || env.REDEEM_CLIENT_TYPE || "MinecraftNet",
        "X-MS-Correlation-ID": flow?.correlationId,
        "X-MS-Market": normalizeMarket(flow?.market),
        "x-MS-Reference-Id": flow?.referenceId,
        "x-MS-Tracking-Id": flow?.trackingId,
        "X-MS-Vector-Id": flow?.vectorId
    };

    return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function throwRedeemError(err, message) {
    const status = err.response?.status;
    const headers = err.response?.headers || {};
    const data = err.response?.data;
    const detail = status ? {
        status,
        message: status === 423 ? "Microsoft locked or blocked this redeem request" : err.message,
        body: data && (typeof data !== "string" || data.trim()) ? data : undefined,
        azureRef: headers["x-azure-ref"],
        buildVersion: headers["build-version"],
        msCv: headers["ms-cv"],
        retryAfter: headers["retry-after"]
    } : err.message || err;

    if (status === 401) throw unauthorized(message, detail);
    if (status === 403) throw forbidden(message, detail);
    if (status >= 400 && status < 500) throw new HttpError(status, message, detail, `UPSTREAM_${status}`);
    throw internal(message, detail);
}

export async function prepareRedeem(redeemToken, {code, market, locale} = {}, flow = {}) {
    if (!code || typeof code !== "string") throw badRequest("code is required");

    const url = `${REDEEM_BASE}/PrepareRedeem?appId=${encodeURIComponent(APP_ID)}&context=LookupToken`;

    const lang = normalizeLocale(locale);
    const m = normalizeMarket(market, lang);
    const normalizedCode = normalizeCode(code);

    const f = {
        ...flow, market: m
    };

    const payload = {
        market: m,
        language: lang,
        flights: resolveFlights(f),
        tokenIdentifierValue: normalizedCode,
        supportsCsvTypeTokenOnly: false,
        buyNowScenario: "redeem",
        clientContext: {
            client: f.clientType || env.REDEEM_CLIENT_TYPE || "MinecraftNet", deviceFamily: f.deviceFamily || env.REDEEM_DEVICE_FAMILY || "Web"
        }
    };

    const msCv = `${String(f.cvBase || env.REDEEM_CV_BASE || DEFAULT_CV_BASE)}.0.3`;

    try {
        const {data} = await http.post(url, payload, {headers: buildHeaders(redeemToken, f, msCv)});
        return data;
    } catch (err) {
        throwRedeemError(err, "Failed to lookup redeem token");
    }
}

export async function redeemCode(redeemToken, {code, paymentSessionId, market, locale} = {}, flow = {}) {
    if (!code || typeof code !== "string") throw badRequest("code is required");
    if (!paymentSessionId || typeof paymentSessionId !== "string") throw badRequest("paymentSessionId is required");

    const url = `${REDEEM_BASE}/RedeemToken?appId=${encodeURIComponent(APP_ID)}`;

    const loc = normalizeLocale(locale);
    const m = normalizeMarket(market, loc);
    const normalizedCode = normalizeCode(code);

    const f = {
        ...flow, market: m
    };

    const payload = {
        market: m, locale: loc, flights: resolveFlights(f), clientContext: {
            client: f.clientType || env.REDEEM_CLIENT_TYPE || "MinecraftNet", deviceFamily: f.deviceFamily || env.REDEEM_DEVICE_FAMILY || "Web"
        }, buyNowScenario: "redeem", paymentInstrumentId: normalizedCode, paymentSessionId, refreshPaymentInstrument: true
    };

    const msCv = `${String(f.cvBase || env.REDEEM_CV_BASE || DEFAULT_CV_BASE)}.0.4`;

    try {
        const {data} = await http.post(url, payload, {headers: buildHeaders(redeemToken, f, msCv)});
        return data;
    } catch (err) {
        throwRedeemError(err, "Failed to redeem code");
    }
}
