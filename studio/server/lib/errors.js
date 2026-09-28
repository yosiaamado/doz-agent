// Error operasional yang aman ditampilkan ke user. Error lain dianggap bug dan disembunyikan (500).
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, message, details);
export const forbidden = (message) => new ApiError(403, message);
export const notFound = (message) => new ApiError(404, message);
export const conflict = (message) => new ApiError(409, message);
