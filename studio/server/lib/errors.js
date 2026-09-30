// Operational errors that are safe to show the user. Anything else is treated as a bug and hidden (500).
// `code` (SCREAMING_SNAKE_CASE) + `params` are what the UI uses to translate the message; `message` remains the fallback.
export class ApiError extends Error {
  constructor(status, message, opts) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    // Older call sites pass the details array directly.
    const { details, code, params } = Array.isArray(opts) ? { details: opts } : (opts ?? {});
    this.details = details;
    this.code = code;
    this.params = params;
  }
}

export const badRequest = (message, opts) => new ApiError(400, message, opts);
export const forbidden = (message, opts) => new ApiError(403, message, opts);
export const notFound = (message, opts) => new ApiError(404, message, opts);
export const conflict = (message, opts) => new ApiError(409, message, opts);

// Errors outside HTTP (engine, runners) that carry a stable code. The English message is the fallback; the UI translates through code + params.
export class CodedError extends Error {
  constructor(message, code, params) {
    super(message);
    this.name = 'CodedError';
    this.code = code;
    this.params = params;
  }
}

// { code, params } is only for CodedError; the `err.code` of a system error (ENOENT, etc.) must never leak out as a UI code.
export const codeOf = (err) => (err instanceof CodedError ? { code: err.code, params: err.params } : {});
