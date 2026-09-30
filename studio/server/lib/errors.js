// Error operasional yang aman ditampilkan ke user. Error lain dianggap bug dan disembunyikan (500).
// `code` (SCREAMING_SNAKE_CASE) + `params` dipakai UI untuk menerjemahkan pesan; `message` tetap fallback.
export class ApiError extends Error {
  constructor(status, message, opts) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    // Call-site lama mengirim array details langsung.
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

// Error di luar HTTP (engine, runner) yang punya kode stabil. Pesan Inggris = fallback; UI menerjemahkan lewat code + params.
export class CodedError extends Error {
  constructor(message, code, params) {
    super(message);
    this.name = 'CodedError';
    this.code = code;
    this.params = params;
  }
}

// { code, params } hanya untuk CodedError; `err.code` milik error sistem (ENOENT, dll.) tidak boleh bocor sebagai kode UI.
export const codeOf = (err) => (err instanceof CodedError ? { code: err.code, params: err.params } : {});
