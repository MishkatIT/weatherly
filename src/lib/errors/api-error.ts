export class ApiError extends Error {
  status: number;
  code: string;
  details?: any;

  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = "Bad Request", details?: any) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Not Found") {
    super(404, "NOT_FOUND", message);
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = "Rate limit exceeded", details?: any) {
    super(429, "RATE_LIMIT_EXCEEDED", message, details);
  }
}

export class UpstreamError extends ApiError {
  constructor(status: number, message: string = "Upstream service error", details?: any) {
    super(status, "UPSTREAM_ERROR", message, details);
  }
}

export class UpstreamTimeoutError extends ApiError {
  constructor(message: string = "Upstream request timed out") {
    super(504, "UPSTREAM_TIMEOUT", message);
  }
}
