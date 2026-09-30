// Uniform response shape: { success, data } or { success: false, error, code?, params?, details? }.
import { ZodError } from 'zod';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export const sendSuccess = (res, data, status = 200) => sendJson(res, status, { success: true, data });

export function sendError(res, error) {
  if (error instanceof ApiError) {
    // A 404 with no specific code (e.g. an endpoint that does not exist) maps to the generic code.
    const code = error.code ?? (error.status === 404 ? 'NOT_FOUND' : undefined);
    return sendJson(res, error.status, { success: false, error: error.message, code, params: error.params, details: error.details });
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`);
    return sendJson(res, 400, { success: false, error: 'Invalid input', code: 'VALIDATION_FAILED', details });
  }
  logger.error('unexpected error', { error: error?.message, stack: error?.stack });
  return sendJson(res, 500, { success: false, error: 'An unexpected server error occurred', code: 'INTERNAL_ERROR' });
}
