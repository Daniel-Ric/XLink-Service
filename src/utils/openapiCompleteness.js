const operations = [
    ["post", "/messaging/session/start", "Messaging", "Start messaging session (alias)", 200],
    ["post", "/mpsd/activities", "MPSD", "Query multiplayer activities", 200],
    ["post", "/mpsd/join", "MPSD", "Join a multiplayer session", 200],
    ["get", "/mpsd/sessions", "MPSD", "List cached sessions owned by the authenticated user", 200],
    ["post", "/mpsd/sessions", "MPSD", "Create and publish a multiplayer session", 201],
    ["delete", "/mpsd/sessions/{scid}/{templateName}/{name}", "MPSD", "Leave a multiplayer session", 200],
    ["get", "/mpsd/sessions/{scid}/{templateName}/{name}", "MPSD", "Get a multiplayer session", 200],
    ["post", "/mpsd/sessions/{scid}/{templateName}/{name}/activity", "MPSD", "Publish session activity", 200],
    ["post", "/mpsd/sessions/{scid}/{templateName}/{name}/invite", "MPSD", "Invite a user to a session", 200],
    ["patch", "/mpsd/sessions/{scid}/{templateName}/{name}/members/{label}/properties", "MPSD", "Update member custom properties", 200],
    ["patch", "/mpsd/sessions/{scid}/{templateName}/{name}/properties", "MPSD", "Update session custom properties", 200],
    ["get", "/openapi.json", "Health", "Download the runtime OpenAPI document", 200, false],
    ["delete", "/people/{xuid}/follow", "People", "Unfollow a user", 200],
    ["put", "/people/{xuid}/follow", "People", "Follow a user", 200],
    ["delete", "/people/{xuid}/friend", "People", "Remove a friend", 200],
    ["put", "/people/{xuid}/friend", "People", "Add a friend", 200],
    ["post", "/people/batch", "People", "Get people in a batch", 200],
    ["get", "/people/following", "People", "List followed users", 200],
    ["get", "/people/recommendations", "People", "List people recommendations", 200],
    ["get", "/people/requests/incoming", "People", "List incoming friend requests", 200],
    ["get", "/people/requests/outgoing", "People", "List outgoing friend requests", 200],
    ["get", "/people/xuid/{xuid}", "People", "Get a person by XUID", 200],
    ["delete", "/presence/title", "Presence", "Remove the current title presence", 200],
    ["post", "/presence/title", "Presence", "Update current title presence", 200],
    ["get", "/presence/xuid/{xuid}", "Presence", "Get presence by XUID", 200],
    ["get", "/rta", "RTA", "List RTA connections owned by the authenticated user", 200],
    ["delete", "/rta/{id}", "RTA", "Close an RTA connection", 200],
    ["get", "/rta/{id}", "RTA", "Get an owned RTA connection", 200],
    ["get", "/rta/{id}/events", "RTA", "Read buffered RTA events", 200],
    ["post", "/rta/{id}/subscribe", "RTA", "Create an RTA subscription", 201],
    ["post", "/rta/{id}/unsubscribe", "RTA", "Remove an RTA subscription", 200],
    ["post", "/rta/connect", "RTA", "Open an authenticated RTA connection", 201],
    ["post", "/xsapi/device-token", "XSAPI", "Create an XAL device token", 200],
    ["post", "/xsapi/nsal/resolve", "XSAPI", "Resolve NSAL policy for an Xbox URL", 200],
    ["post", "/xsapi/proof-key", "XSAPI", "Create an Xbox proof key", 200],
    ["post", "/xsapi/request", "XSAPI", "Send a signed request to an allowed Xbox service host", 200],
    ["post", "/xsapi/session", "XSAPI", "Create a SISU/XAL token session", 200],
    ["post", "/xsapi/signature", "XSAPI", "Sign an Xbox service request", 200],
    ["post", "/xsapi/xsts", "XSAPI", "Authorize a signed XSTS token", 200]
];

function pathParameters(operationPath) {
    return [...operationPath.matchAll(/\{([^}]+)}/g)].map(match => ({
        in: "path",
        name: match[1],
        required: true,
        schema: {type: "string", minLength: 1}
    }));
}

const xboxHeader = {in: "header", name: "x-xbl-token", required: true, schema: {type: "string"}, description: "Xbox XSTS authorization token bound to the bearer session."};
const requestContracts = {
    "POST /mpsd/activities": {required: ["scid"], properties: {scid: {type: "string", format: "uuid"}, xuids: {type: "array", maxItems: 100, items: {type: "string"}}, socialGroup: {type: "string", enum: ["people", "favorites"]}}},
    "POST /mpsd/join": {required: ["handleId"], properties: {handleId: {type: "string", format: "uuid"}, connectionId: {type: "string", format: "uuid"}, subscriptionId: {type: "string", format: "uuid"}}},
    "POST /mpsd/sessions": {required: ["scid", "templateName"], properties: {scid: {type: "string", format: "uuid"}, templateName: {type: "string", minLength: 1}, name: {type: "string"}, writeActivity: {type: "boolean"}}},
    "POST /mpsd/sessions/{scid}/{templateName}/{name}/invite": {required: ["xuid", "titleId"], properties: {xuid: {type: "string"}, titleId: {type: "string"}, contextString: {type: "string"}, context: {type: "string"}}},
    "PATCH /mpsd/sessions/{scid}/{templateName}/{name}/properties": {required: ["customProperties"], properties: {customProperties: {}}},
    "PATCH /mpsd/sessions/{scid}/{templateName}/{name}/members/{label}/properties": {required: ["customProperties"], properties: {customProperties: {}}},
    "POST /people/batch": {required: ["xuids"], properties: {xuids: {type: "array", minItems: 1, maxItems: 100, items: {type: "string"}}}},
    "POST /presence/title": {required: ["titleId"], properties: {titleId: {type: "string"}, state: {type: "string"}, activity: {type: "object"}}},
    "POST /rta/connect": {properties: {}},
    "POST /rta/{id}/subscribe": {required: ["resourceUri"], properties: {resourceUri: {type: "string", format: "uri", maxLength: 2048}}},
    "POST /rta/{id}/unsubscribe": {required: ["subscriptionId"], properties: {subscriptionId: {type: "integer", minimum: 0}}},
    "POST /xsapi/device-token": {properties: {proofKeyJwk: {type: "object"}, deviceId: {type: "string", format: "uuid"}}},
    "POST /xsapi/session": {required: ["msAccessToken"], properties: {msAccessToken: {type: "string"}, proofKeyJwk: {type: "object"}, deviceToken: {type: "object"}}},
    "POST /xsapi/xsts": {required: ["proofKeyJwk", "relyingParty"], properties: {proofKeyJwk: {type: "object"}, relyingParty: {type: "string", format: "uri"}, deviceToken: {type: "object"}}},
    "POST /xsapi/nsal/resolve": {required: ["url"], properties: {url: {type: "string", format: "uri"}, method: {type: "string"}, titleData: {}}},
    "POST /xsapi/signature": {required: ["method", "url", "proofKeyJwk"], properties: {method: {type: "string"}, url: {type: "string", format: "uri"}, headers: {type: "object"}, body: {}, proofKeyJwk: {type: "object"}, policy: {type: "object"}}},
    "POST /xsapi/request": {required: ["method", "url"], properties: {method: {type: "string"}, url: {type: "string", format: "uri"}, headers: {type: "object"}, body: {}, sign: {type: "boolean"}, proofKeyJwk: {type: "object"}}}
};

function responseSchema(tag) {
    const names = {MPSD: "session", People: "people", Presence: "presence", RTA: "connection", XSAPI: "data", Health: "openapi"};
    return {type: "object", description: `Structured ${tag} response.`, additionalProperties: true, properties: {[names[tag] || "result"]: {description: "Primary operation result."}}};
}

export function addMissingOpenApiOperations(spec) {
    for (const [method, operationPath, tag, summary, successStatus, authenticated = true] of operations) {
        spec.paths[operationPath] ||= {};
        if (spec.paths[operationPath][method]) continue;
        const key = `${method.toUpperCase()} ${operationPath}`;
        const parameters = pathParameters(operationPath);
        const needsXbox = (operationPath.startsWith("/mpsd/") && operationPath !== "/mpsd/sessions") ||
            operationPath.startsWith("/people/") || operationPath.startsWith("/presence/") || operationPath === "/rta/connect";
        if (needsXbox) parameters.push(xboxHeader);
        const contract = requestContracts[key];
        const acceptsBody = Boolean(contract) || (!['get', 'delete'].includes(method) && !operationPath.match(/^\/people\/\{xuid\}\/(follow|friend)$/));
        spec.paths[operationPath][method] = {
            summary,
            tags: [tag],
            security: authenticated ? [{BearerAuth: []}] : [],
            ...(parameters.length ? {parameters} : {}),
            ...(acceptsBody ? {
                requestBody: {
                    required: Boolean(contract?.required?.length),
                    content: {"application/json": {schema: {type: "object", additionalProperties: true, ...(contract || {})}}}
                }
            } : {}),
            responses: {
                [successStatus]: {
                    description: "Successful operation",
                    content: {"application/json": {schema: responseSchema(tag)}}
                },
                ...(authenticated ? {
                    401: {description: "Missing or invalid XLink bearer JWT", content: {"application/json": {schema: {$ref: "#/components/schemas/ErrorResponse"}}}},
                    403: {description: "Credential or resource is not bound to this XLink session", content: {"application/json": {schema: {$ref: "#/components/schemas/ErrorResponse"}}}}
                } : {}),
                400: {description: "Invalid request", content: {"application/json": {schema: {$ref: "#/components/schemas/ErrorResponse"}}}},
                502: {description: "Invalid or failed upstream response", content: {"application/json": {schema: {$ref: "#/components/schemas/ErrorResponse"}}}}
            }
        };
    }
    const messagingStart = spec.paths?.["/messaging/inbox/start"]?.post;
    if (messagingStart) {
        spec.paths["/messaging/session/start"].post = structuredClone(messagingStart);
        spec.paths["/messaging/session/start"].post.summary = "Start messaging session (alias)";
    }
    return spec;
}
