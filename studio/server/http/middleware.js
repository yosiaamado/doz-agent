import { forbidden, badRequest } from '../lib/errors.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const MAX_BODY = 25 * 1024 * 1024; // enough for base64 document attachments

// Rejects requests that do not originate from localhost (DNS rebinding / CSRF from another site).
export function assertLocalRequest(req) {
  const host = (req.headers.host ?? '').replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(host)) throw forbidden('Only localhost may access this server', { code: 'LOCAL_ONLY' });
  const origin = req.headers.origin;
  if (!origin) return;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw forbidden('Invalid origin', { code: 'ORIGIN_INVALID' });
  }
  // Another local program on a different port is a different origin, so only this server's own port (or the Vite dev port) passes.
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  const allowed = [req.socket?.localPort, Number(process.env.DOZ_STUDIO_DEV_PORT) || null];
  if (!LOCAL_HOSTS.has(parsed.hostname) || !allowed.includes(port)) throw forbidden('Origin not allowed', { code: 'ORIGIN_FORBIDDEN' });
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
