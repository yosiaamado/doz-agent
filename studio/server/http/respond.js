// Format respons seragam: { success, data } atau { success: false, error, details }.
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
    return sendJson(res, error.status, { success: false, error: error.message, details: error.details });
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`);
    return sendJson(res, 400, { success: false, error: 'Input tidak valid', details });
  }
  logger.error('unexpected error', { error: error?.message, stack: error?.stack });
  return sendJson(res, 500, { success: false, error: 'Terjadi kesalahan di server' });
}
