import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth requests, please slow down." }
});
