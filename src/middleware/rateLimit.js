import rateLimit from "express-rate-limit";
import {tooManyRequests} from "../utils/httpError.js";

export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(tooManyRequests("Too many auth requests, please slow down."))
});
