import { HttpError } from "../utils/httpError.js";

export function notFoundHandler(req, res, next) {
    next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`, undefined, "HTTP_404"));
}

export function errorHandler(err, req, res, next) {
    const status = err instanceof HttpError ? err.status : 500;
    const code = err.code || (err instanceof HttpError ? `HTTP_${status}` : "INTERNAL");
    const body = { error: { code, message: err.message || "Internal Server Error" } };
    if (err.details) body.error.details = err.details;
    if (process.env.NODE_ENV !== "production" && err.stack) body.error.stack = err.stack;
    res.status(status).json(body);
}
