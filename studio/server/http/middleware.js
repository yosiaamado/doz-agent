import { forbidden, badRequest } from '../lib/errors.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const MAX_BODY = 25 * 1024 * 1024; // cukup untuk lampiran dokumen base64

// Menolak request yang tidak berasal dari localhost (DNS rebinding / CSRF dari situs lain).
export function assertLocalRequest(req) {
  const host = (req.headers.host ?? '').replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(host)) throw forbidden('Only localhost may access this server', { code: 'LOCAL_ONLY' });
  const origin = req.headers.origin;
  if (!origin) return;
  let hostname;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    throw forbidden('Invalid origin', { code: 'ORIGIN_INVALID' });
  }
  if (!LOCAL_HOSTS.has(hostname)) throw forbidden('Origin not allowed', { code: 'ORIGIN_FORBIDDEN' });
}

export function isLocalRequest(req) {
  try {
    assertLocalRequest(req);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonBody(req, limit = MAX_BODY) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > limit) throw badRequest('Request body is too large', { code: 'BODY_TOO_LARGE' });
  }
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    throw badRequest('Request body is not valid JSON', { code: 'BODY_INVALID_JSON' });
  }
}
