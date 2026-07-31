import swaggerJSDoc from "swagger-jsdoc";
import {env} from "../config/env.js";

const serverUrl = env.SWAGGER_SERVER_URL || `http://localhost:${env.PORT}`;

const options = {
    definition: {
        openapi: "3.0.3", info: {
            title: "Xbox + Minecraft REST API",
            version: "2.3.0",
            description: "Standalone service that exposes Xbox Live and Minecraft authentication, profile, stats and inventory APIs over a simple REST interface."
        }, servers: [{url: serverUrl, description: env.NODE_ENV}], tags: [{
            name: "Health",
            description: "Liveness and readiness probes used by load balancers and orchestration platforms."
        }, {
            name: "Auth", description: "Microsoft device-code and browser login, token exchange and JWT convenience endpoints."
        }, {
            name: "Lookup", description: "Utilities to resolve between Gamertag and XUID using Xbox Live profile APIs."
        }, {
            name: "Profile",
            description: "Xbox profile settings, TitleHub integration and combined high-level player overview."
        }, {
            name: "Titles", description: "Recently played titles and title history information returned by TitleHub."
        }, {name: "Captures", description: "Access to game clips and screenshots captured on Xbox."}, {
            name: "People", description: "Friends, followers and social graph information from PeopleHub."
        }, {
            name: "Presence",
            description: "Online status and last-seen presence information for the signed-in user and friends."
        }, {
            name: "Achievements", description: "Xbox achievement lists and progress summaries for titles."
        }, {
            name: "Stats", description: "Aggregated Xbox user statistics, with a focus on Minecraft-related SCIDs."
        }, {
            name: "Inventory", description: "PlayFab inventory items and Minecraft Marketplace entitlements."
        }, {
            name: "PlayFab", description: "Thin wrapper around PlayFab Client APIs using a SessionTicket."
        }, {
            name: "Minecraft", description: "Minecraft multiplayer token helper and Marketplace-related features."
        }, {
            name: "Messaging", description: "Marketplace inbox and messaging sessions."
        }, {
            name: "XSAPI", description: "Proof-key, SISU/XAL, NSAL and signed Xbox Services request helpers."
        }, {
            name: "RTA", description: "Xbox Real-Time Activity connection and subscription helpers."
        }, {
            name: "MPSD", description: "Xbox Multiplayer Session Directory activities, sessions and invites."
        }, {
            name: "Debug", description: "Token inspection helpers for JWT, XSTS, Minecraft tokens and PlayFab tickets."
        }], components: {
            securitySchemes: {
                BearerAuth: {type: "http", scheme: "bearer", bearerFormat: "JWT"}, XBLToken: {
                    type: "apiKey", in: "header", name: "x-xbl-token", description: "XBL3.0 x={uhs};{xstsToken}"
                }, MCToken: {
                    type: "apiKey",
                    in: "header",
                    name: "x-mc-token",
                    description: "Minecraft Authorization Header (\"MCToken …\")"
                }
            }, schemas: {
                AuthDeviceResponse: {
                    type: "object", properties: {
                        device_code: {type: "string"},
                        user_code: {type: "string"},
                        verification_url: {type: "string"},
                        verification_uri: {type: "string"},
                        expires_in: {type: "integer"},
                        interval: {type: "integer"},
                        message: {type: "string"}
                    }
                }, AuthCallbackResponse: {
                    type: "object", properties: {
                        jwt: {type: "string"},
                        xuid: {type: "string"},
                        gamertag: {type: "string"},
                        uhs: {type: "string"},
                        msAccessToken: {type: "string"},
                        msRefreshToken: {type: "string"},
                        msExpiresIn: {type: "integer"},
                        xblToken: {type: "string"},
                        xsts: {
                            type: "object", properties: {
                                xbox: {type: "object"}, redeem: {type: "object"}, playfab: {type: "object"}
                            }
                        },
                        xboxliveToken: {type: "string"},
                        playfabToken: {type: "string"},
                        redeemToken: {type: "string"},
                        mcToken: {type: "string"},
                        sessionTicket: {type: "string"},
                        playFabId: {type: "string"},
                        entityToken: {type: "string"},
                        entityTokenExpiresOn: {type: "string"},
                        entityTokenMaster: {type: "string"},
                        entityTokenMasterExpiresOn: {type: "string"}
                    }
                }, ProfileOverviewRequest: {
                    type: "object", properties: {
                        sessionTicket: {type: "string"},
                        playFabId: {type: "string"},
                        includeReceipt: {type: "boolean", default: false}
                    }
                }, InventoryPlayFabRequest: {
                    type: "object", required: ["sessionTicket"], properties: {
                        sessionTicket: {type: "string"},
                        playFabId: {type: "string"},
                        collectionId: {type: "string", default: "default"},
                        count: {type: "integer", default: 50, minimum: 1, maximum: 200}
                    }
                }, TokenDecodeRequest: {
                    type: "object", required: ["token"], properties: {
                        token: {type: "string"}, type: {type: "string", enum: ["jwt", "xsts", "mc"]}
                    }
                }, TokenDecodeBatchRequest: {
                    type: "object", required: ["tokens"], properties: {
                        tokens: {type: "object", additionalProperties: {type: "string"}}
                    }
                }, TokenDecoded: {
                    type: "object", properties: {
                        ok: {type: "boolean"},
                        header: {type: "object", nullable: true},
                        payload: {type: "object", nullable: true},
                        meta: {
                            type: "object", properties: {
                                prefix: {type: "string", nullable: true},
                                uhs: {type: "string", nullable: true},
                                hasExp: {type: "boolean"},
                                secondsRemaining: {type: "integer", nullable: true},
                                rawLength: {type: "integer"}
                            }
                        }
                    }
                }, TokenDecodeCallbackRequest: {
                    type: "object", additionalProperties: true, properties: {
                        callback: {type: "object", additionalProperties: true},
                        jwt: {type: "string"},
                        xuid: {type: "string"},
                        gamertag: {type: "string"},
                        uhs: {type: "string"},
                        xboxliveToken: {type: "string"},
                        playfabToken: {type: "string"},
                        redeemToken: {type: "string"},
                        mcToken: {type: "string"},
                        sessionTicket: {type: "string"},
                        playFabId: {type: "string"},
                        msAccessToken: {type: "string"},
                        msRefreshToken: {type: "string"},
                        xblToken: {type: "string"},
                        xstsXbox: {type: "string"},
                        xstsRedeem: {type: "string"},
                        xstsPlayFab: {type: "string"},
                        xsts: {type: "object", additionalProperties: true}
                    }
                }, TokenDecodeCallbackResponse: {
                    type: "object", properties: {
                        user: {
                            type: "object", properties: {
                                xuid: {type: "string", nullable: true},
                                gamertag: {type: "string", nullable: true},
                                playFabId: {type: "string", nullable: true},
                                uhs: {type: "string", nullable: true}
                            }
                        }, decoded: {
                            type: "object", additionalProperties: {$ref: "#/components/schemas/TokenDecoded"}
                        }
                    }
                }, ErrorResponse: {
                    type: "object", properties: {
                        error: {
                            type: "object", properties: {
                                code: {type: "string"},
                                message: {type: "string"},
                                details: {type: "string"}
                            }
                        }
                    }
                }
            }
        }, security: [{BearerAuth: []}], paths: {
            "/auth/browser": {
                get: {
                    summary: "Start Microsoft browser sign-in",
                    description: "Redirects to Microsoft Entra sign-in and consent using authorization code flow with PKCE. The source is bound to the server-side OAuth state.",
                    tags: ["Auth"],
                    security: [],
                    parameters: [{
                        in: "query",
                        name: "source",
                        schema: {type: "string", enum: ["direct", "website", "client"], default: "direct"}
                    }, {
                        in: "query",
                        name: "session",
                        schema: {type: "string"},
                        description: "Required for non-browser clients; returned by POST /auth/browser/session"
                    }],
                    responses: {
                        302: {description: "Redirect to Microsoft sign-in"},
                        400: {
                            description: "Browser OAuth is not configured or CLIENT_ID is not an Entra GUID",
                            content: {"application/json": {schema: {$ref: "#/components/schemas/ErrorResponse"}}}
                        }
                    }
                }
            },
            "/auth/browser/session": {
                post: {
                    summary: "Create a client browser-login handoff",
                    description: "Creates a short-lived browser session and a separate private polling token.",
                    tags: ["Auth"],
                    security: [],
                    responses: {
                        201: {description: "Browser session created"},
                        400: {description: "Invalid source or browser OAuth configuration"}
                    }
                }
            },
            "/auth/browser/callback": {
                get: {
                    summary: "Complete Microsoft browser sign-in",
                    description: "Validates the one-time OAuth state, exchanges the authorization code and creates the standard auth token bundle.",
                    tags: ["Auth"],
                    security: [],
                    parameters: [{
                        in: "query",
                        name: "code",
                        schema: {type: "string"}
                    }, {
                        in: "query",
                        name: "state",
                        required: true,
                        schema: {type: "string"}
                    }, {
                        in: "query",
                        name: "error",
                        schema: {type: "string"}
                    }],
                    responses: {
                        200: {
                            description: "Standard auth response when no frontend redirect is configured",
                            content: {"application/json": {schema: {$ref: "#/components/schemas/AuthCallbackResponse"}}}
                        },
                        303: {description: "Redirect to the configured frontend with a short-lived one-time result code"},
                        400: {
                            description: "Invalid, expired, reused state or rejected Microsoft sign-in",
                            content: {"application/json": {schema: {$ref: "#/components/schemas/ErrorResponse"}}}
                        }
                    }
                }
            },
            "/auth/browser/token": {
                post: {
                    summary: "Redeem a browser-login result code",
                    description: "Exchanges the short-lived one-time frontend code for the standard auth response.",
                    tags: ["Auth"],
                    security: [],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["code"],
                                    properties: {
                                        code: {type: "string"},
                                        source: {type: "string", enum: ["direct", "website"], default: "direct"}
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: "Standard auth response",
                            content: {"application/json": {schema: {$ref: "#/components/schemas/AuthCallbackResponse"}}}
                        },
                        400: {
                            description: "Missing, invalid, expired or reused result code",
                            content: {"application/json": {schema: {$ref: "#/components/schemas/ErrorResponse"}}}
                        }
                    }
                }
            },
            "/auth/browser/session/token": {
                post: {
                    summary: "Poll a client browser-login handoff",
                    description: "Returns pending until Microsoft sign-in completes, then returns and consumes the standard auth response.",
                    tags: ["Auth"],
                    security: [],
                    requestBody: {
                        required: true,
                        content: {"application/json": {schema: {
                            type: "object",
                            required: ["sessionId", "pollToken"],
                            properties: {
                                sessionId: {type: "string"},
                                pollToken: {type: "string"}
                            }
                        }}}
                    },
                    responses: {
                        200: {
                            description: "Standard auth response",
                            content: {"application/json": {schema: {$ref: "#/components/schemas/AuthCallbackResponse"}}}
                        },
                        202: {description: "Sign-in is still pending"},
                        400: {description: "Invalid, expired or reused browser session"}
                    }
                }
            },
            "/debug/decode-token": {
                post: {
                    summary: "Decode JWT, XSTS (XBL3.0), MCToken, and PlayFab sessionTicket",
                    tags: ["Debug"],
                    security: [{BearerAuth: []}],
                    requestBody: {
                        required: true, content: {
                            "application/json": {
                                schema: {
                                    oneOf: [{$ref: "#/components/schemas/TokenDecodeRequest"}, {$ref: "#/components/schemas/TokenDecodeBatchRequest"}]
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: "Decoded token(s)", content: {
                                "application/json": {
                                    schema: {
                                        oneOf: [{$ref: "#/components/schemas/TokenDecoded"}, {
                                            type: "object", properties: {
                                                ok: {type: "boolean"}, decoded: {
                                                    type: "object",
                                                    additionalProperties: {$ref: "#/components/schemas/TokenDecoded"}
                                                }
                                            }
                                        }]
                                    }
                                }
                            }
                        }
                    }
                }
            }, "/debug/decode-callback": {
                post: {
                    summary: "Decode full auth callback bundle",
                    tags: ["Debug"],
                    security: [{BearerAuth: []}],
                    requestBody: {
                        required: false, content: {
                            "application/json": {
                                schema: {
                                    oneOf: [{$ref: "#/components/schemas/AuthCallbackResponse"}, {$ref: "#/components/schemas/TokenDecodeCallbackRequest"}]
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: "Decoded bundle",
                            content: {"application/json": {schema: {$ref: "#/components/schemas/TokenDecodeCallbackResponse"}}}
                        }
                    }
                }
            }
        }
    }, apis: ["./src/routes/*.js"]
};

export const swaggerSpec = swaggerJSDoc(options);
