export class HttpError extends Error {
    constructor(status, message, details, code) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        if (details) this.details = details;
        if (code) this.code = code;
    }
}

export function badRequest(msg, details) {
    return new HttpError(400, msg, details, "BAD_REQUEST");
}

export function unauthorized(msg = "Unauthorized", details) {
    return new HttpError(401, msg, details, "UNAUTHORIZED");
}

export function forbidden(msg = "Forbidden", details) {
    return new HttpError(403, msg, details, "FORBIDDEN");
}

export function notFound(msg = "Not Found", details) {
    return new HttpError(404, msg, details, "NOT_FOUND");
}

export function conflict(msg = "Conflict", details) {
    return new HttpError(409, msg, details, "CONFLICT");
}

export function tooManyRequests(msg = "Too Many Requests", details) {
    return new HttpError(429, msg, details, "TOO_MANY_REQUESTS");
}

export function internal(msg = "Internal Server Error", details) {
    return new HttpError(500, msg, details, "INTERNAL");
}
