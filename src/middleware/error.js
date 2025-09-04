import { HttpError } from "../utils/httpError.js";

export function notFoundHandler(req, res, next) {
    next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(err, req, res, next) {
    const status = err instanceof HttpError ? err.status : 500;
    const body = {
        error: err.message || "Internal Server Error",
    };
    if (err.details) body.details = err.details;
    if (process.env.NODE_ENV !== "production" && err.stack) body.stack = err.stack;
    res.status(status).json(body);
}
