import "dotenv/config";
import Joi from "joi";

const schema = Joi.object({
    PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
    CORS_ORIGIN: Joi.string().default("*"),
    JWT_SECRET: Joi.string().min(16).required(),
    JWT_EXPIRES_IN: Joi.string().default("1h"),
    CLIENT_ID: Joi.string().required(),
    HTTP_TIMEOUT_MS: Joi.number().default(15000),
    LOG_LEVEL: Joi.string().default("info"),
    LOG_PRETTY: Joi.when("NODE_ENV", {
        is: "production",
        then: Joi.boolean().truthy("true").falsy("false").default(false),
        otherwise: Joi.boolean().truthy("true").falsy("false").default(true)
    }),
    MC_GAME_VERSION: Joi.string().default("1.21.62"),
    MC_PLATFORM: Joi.string().default("Windows10"),
    PLAYFAB_TITLE_ID: Joi.string().default("20ca2"),
    ACCEPT_LANGUAGE: Joi.string().default("en-US"),
    REDEEM_FLIGHTS_JSON: Joi.string().optional(),
    REDEEM_USER_AGENT: Joi.string().optional(),
    REDEEM_SEC_CH_UA: Joi.string().optional(),
    REDEEM_CV_BASE: Joi.string().optional(),
    REDEEM_CLIENT_TYPE: Joi.string().default("MinecraftNet"),
    REDEEM_DEVICE_FAMILY: Joi.string().default("Web"),
    SWAGGER_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
    SWAGGER_SERVER_URL: Joi.string().uri().optional(),
    TRUST_PROXY: Joi.alternatives().try(Joi.boolean(), Joi.string()).default("loopback")
}).unknown(true);

const {value, error} = schema.validate(process.env, {abortEarly: false});
if (error) {
    console.error("❌ Invalid environment configuration:", error.message);
    process.exit(1);
}

export const env = value;
