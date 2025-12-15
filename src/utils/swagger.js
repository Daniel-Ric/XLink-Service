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
            name: "Auth", description: "Microsoft device-flow login, token exchange and JWT convenience endpoints."
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
                        playFabId: {type: "string"}
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
                        error: {type: "string"}, details: {type: "string"}
                    }
                }
            }
        }, security: [{BearerAuth: []}], paths: {
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
