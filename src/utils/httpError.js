export class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.name = "HttpError";
        this.status = status;
        if (details) this.details = details;
    }
}

export function badRequest(msg, details) {
    return new HttpError(400, msg, details);
}
export function unauthorized(msg = "Unauthorized", details) {
    return new HttpError(401, msg, details);
}
export function forbidden(msg = "Forbidden", details) {
    return new HttpError(403, msg, details);
}
export function notFound(msg = "Not Found", details) {
    return new HttpError(404, msg, details);
}
export function conflict(msg = "Conflict", details) {
    return new HttpError(409, msg, details);
}
export function tooManyRequests(msg = "Too Many Requests", details) {
    return new HttpError(429, msg, details);
}
export function internal(msg = "Internal Server Error", details) {
    return new HttpError(500, msg, details);
}
