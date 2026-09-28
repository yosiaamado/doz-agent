import { forbidden, badRequest } from '../lib/errors.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const MAX_BODY = 25 * 1024 * 1024; // cukup untuk lampiran dokumen base64

// Menolak request yang tidak berasal dari localhost (DNS rebinding / CSRF dari situs lain).
export function assertLocalRequest(req) {
  const host = (req.headers.host ?? '').replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(host)) throw forbidden('hanya boleh diakses dari localhost');
  const origin = req.headers.origin;
  if (!origin) return;
  let hostname;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    throw forbidden('origin tidak valid');
  }
  if (!LOCAL_HOSTS.has(hostname)) throw forbidden('origin tidak diizinkan');
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
    if (data.length > limit) throw badRequest('body terlalu besar');
  }
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    throw badRequest('body bukan JSON yang valid');
  }
}
