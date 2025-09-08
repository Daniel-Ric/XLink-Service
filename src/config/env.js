import "dotenv/config";
import Joi from "joi";

const schema = Joi.object({
    PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
    CORS_ORIGIN: Joi.string().default("*"),
    JWT_SECRET: Joi.string().min(16).required(),
    CLIENT_ID: Joi.string().required(),
    HTTP_TIMEOUT_MS: Joi.number().default(15000),
    LOG_LEVEL: Joi.string().default("info"),
    LOG_PRETTY: Joi.when("NODE_ENV", { is: "production", then: Joi.boolean().truthy("true").falsy("false").default(false), otherwise: Joi.boolean().truthy("true").falsy("false").default(true) }),
    MC_GAME_VERSION: Joi.string().default("1.21.62"),
    MC_PLATFORM: Joi.string().default("Windows10"),
    PLAYFAB_TITLE_ID: Joi.string().default("20ca2"),
    ACCEPT_LANGUAGE: Joi.string().default("en-US"),
    SWAGGER_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
    SWAGGER_SERVER_URL: Joi.string().uri().optional(),
    TRUST_PROXY: Joi.alternatives().try(Joi.boolean(), Joi.string()).default("loopback")
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
    console.error("❌ Invalid environment configuration:", error.message);
    process.exit(1);
}

export const env = value;
