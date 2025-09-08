import swaggerJSDoc from "swagger-jsdoc";
import { env } from "../config/env.js";

const serverUrl = env.SWAGGER_SERVER_URL || `http://localhost:${env.PORT}`;

const options = {
    definition: {
        openapi: "3.0.3",
        info: { title: "Xbox + Minecraft REST API", version: "2.3.0", description: "Standalone service für Xbox Live + Minecraft Auth & Stats" },
        servers: [{ url: serverUrl, description: env.NODE_ENV }],
        tags: [
            { name: "Health" },
            { name: "Auth" },
            { name: "Lookup" },
            { name: "Profile" },
            { name: "Titles" },
            { name: "Captures" },
            { name: "People" },
            { name: "Presence" },
            { name: "Achievements" },
            { name: "Stats" },
            { name: "Inventory" },
            { name: "PlayFab" },
            { name: "Minecraft" },
            { name: "Debug" }
        ],
        components: {
            securitySchemes: {
                BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
                XBLToken: { type: "apiKey", in: "header", name: "x-xbl-token", description: "XBL3.0 x={uhs};{xstsToken}" },
                MCToken: { type: "apiKey", in: "header", name: "x-mc-token", description: "Minecraft Authorization Header (\"MCToken …\")" }
            },
            schemas: {
                AuthDeviceResponse: {
                    type: "object",
                    properties: {
                        device_code: { type: "string" },
                        user_code: { type: "string" },
                        verification_url: { type: "string" },
                        expires_in: { type: "integer" },
                        interval: { type: "integer" },
                        message: { type: "string" }
                    }
                },
                AuthCallbackResponse: {
                    type: "object",
                    properties: {
                        jwt: { type: "string" },
                        xuid: { type: "string" },
                        gamertag: { type: "string" },
                        xboxliveToken: { type: "string" },
                        playfabToken: { type: "string" },
                        redeemToken: { type: "string" },
                        mcToken: { type: "string" },
                        sessionTicket: { type: "string" },
                        playFabId: { type: "string" }
                    }
                },
                ProfileOverviewRequest: {
                    type: "object",
                    properties: {
                        sessionTicket: { type: "string" },
                        playFabId: { type: "string" },
                        includeReceipt: { type: "boolean", default: false }
                    }
                },
                InventoryPlayFabRequest: {
                    type: "object",
                    required: ["sessionTicket"],
                    properties: {
                        sessionTicket: { type: "string" },
                        playFabId: { type: "string" },
                        collectionId: { type: "string", default: "default" },
                        count: { type: "integer", default: 50, minimum: 1, maximum: 200 }
                    }
                },
                TokenDecodeRequest: {
                    type: "object",
                    required: ["token"],
                    properties: {
                        token: { type: "string" },
                        type: { type: "string", enum: ["jwt", "xsts", "mc"] }
                    }
                },
                TokenDecodeBatchRequest: {
                    type: "object",
                    required: ["tokens"],
                    properties: {
                        tokens: { type: "object", additionalProperties: { type: "string" } }
                    }
                },
                TokenDecoded: {
                    type: "object",
                    properties: {
                        ok: { type: "boolean" },
                        header: { type: "object", nullable: true },
                        payload: { type: "object", nullable: true },
                        meta: {
                            type: "object",
                            properties: {
                                prefix: { type: "string", nullable: true },
                                uhs: { type: "string", nullable: true },
                                hasExp: { type: "boolean" },
                                secondsRemaining: { type: "integer", nullable: true },
                                rawLength: { type: "integer" }
                            }
                        }
                    }
                },
                TokenDecodeCallbackRequest: {
                    type: "object",
                    properties: {
                        jwt: { type: "string" },
                        xuid: { type: "string" },
                        gamertag: { type: "string" },
                        xboxliveToken: { type: "string" },
                        playfabToken: { type: "string" },
                        redeemToken: { type: "string" },
                        mcToken: { type: "string" },
                        sessionTicket: { type: "string" },
                        playFabId: { type: "string" }
                    }
                },
                TokenDecodeCallbackResponse: {
                    type: "object",
                    properties: {
                        user: {
                            type: "object",
                            properties: {
                                xuid: { type: "string", nullable: true },
                                gamertag: { type: "string", nullable: true },
                                playFabId: { type: "string", nullable: true }
                            }
                        },
                        decoded: {
                            type: "object",
                            additionalProperties: { $ref: "#/components/schemas/TokenDecoded" }
                        }
                    }
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        error: { type: "string" },
                        details: { type: "string" }
                    }
                }
            }
        },
        security: [{ BearerAuth: [] }],
        paths: {
            "/debug/decode-token": {
                post: {
                    summary: "Decode JWT, XSTS (XBL3.0), MCToken, and PlayFab sessionTicket",
                    tags: ["Debug"],
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    oneOf: [
                                        { $ref: "#/components/schemas/TokenDecodeRequest" },
                                        { $ref: "#/components/schemas/TokenDecodeBatchRequest" }
                                    ]
                                }
                            }
                        }
                    },
                    responses: {
                        200: {
                            description: "Decoded token(s)",
                            content: {
                                "application/json": {
                                    schema: {
                                        oneOf: [
                                            { $ref: "#/components/schemas/TokenDecoded" },
                                            {
                                                type: "object",
                                                properties: {
                                                    ok: { type: "boolean" },
                                                    decoded: {
                                                        type: "object",
                                                        additionalProperties: { $ref: "#/components/schemas/TokenDecoded" }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/debug/decode-callback": {
                post: {
                    summary: "Decode full auth callback bundle",
                    tags: ["Debug"],
                    security: [{ BearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: { "application/json": { schema: { $ref: "#/components/schemas/TokenDecodeCallbackRequest" } } }
                    },
                    responses: {
                        200: {
                            description: "Decoded bundle",
                            content: { "application/json": { schema: { $ref: "#/components/schemas/TokenDecodeCallbackResponse" } } }
                        }
                    }
                }
            }
        }
    },
    apis: ["./src/routes/*.js"]
};

export const swaggerSpec = swaggerJSDoc(options);
