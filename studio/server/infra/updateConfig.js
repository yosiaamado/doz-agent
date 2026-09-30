// The update endpoint: default, user override, HTTPS validation, and semver comparison.
import { badRequest } from '../lib/errors.js';

// Derived from `git remote get-url origin` (github.com/yosiaamado/doz-agent) -> GitHub Releases.
// If the repo/asset does not exist yet, the update check soft-fails with UPDATE_UNREACHABLE; the studio keeps running.
export const DEFAULT_UPDATE_ENDPOINT = 'https://github.com/yosiaamado/doz-agent/releases/latest/download/doz-update.json';

export const MAX_ENDPOINT_LENGTH = 2048;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

const insecure = (endpoint) => badRequest('Update endpoint must use HTTPS', { code: 'UPDATE_INSECURE_ENDPOINT', params: { endpoint: String(endpoint).slice(0, 200) } });

// The http escape hatch only exists in the test runtime (node --test sets NODE_TEST_CONTEXT; NODE_ENV=test for other runners).
// A production build carries neither marker, so DOZ_UPDATE_ALLOW_HTTP=1 on its own is not enough to downgrade from HTTPS.
export const isTestRuntime = (env = process.env) => env.NODE_ENV === 'test' || env.NODE_TEST_CONTEXT !== undefined;

// http is for automated tests only: test runtime + DOZ_UPDATE_ALLOW_HTTP=1 + a loopback host.
export function isAllowedUrl(url, env = process.env) {
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && env.DOZ_UPDATE_ALLOW_HTTP === '1' && isTestRuntime(env) && LOOPBACK_HOSTS.has(url.hostname);
}

export function validateEndpoint(value, env = process.env) {
  if (typeof value !== 'string' || !value || value.length > MAX_ENDPOINT_LENGTH) throw insecure(value ?? '');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw insecure(value);
  }
  if (!isAllowedUrl(url, env)) throw insecure(value);
  return url.toString();
}

export function resolveEndpoint(saved) {
  const custom = saved?.update?.endpoint;
  return typeof custom === 'string' && custom ? { endpoint: custom, endpointIsDefault: false } : { endpoint: DEFAULT_UPDATE_ENDPOINT, endpointIsDefault: true };
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
export const isSemver = (v) => typeof v === 'string' && v.length <= 64 && SEMVER_RE.test(v);

// -1 | 0 | 1. A version without a pre-release is greater than the same version with one.
export function compareVersions(a, b) {
  const [, ...pa] = SEMVER_RE.exec(a) ?? [];
  const [, ...pb] = SEMVER_RE.exec(b) ?? [];
  for (let i = 0; i < 3; i += 1) {
    const diff = Number(pa[i] ?? 0) - Number(pb[i] ?? 0);
    if (diff) return diff < 0 ? -1 : 1;
  }
  const [preA, preB] = [pa[3], pb[3]];
  if (preA === preB) return 0;
  if (!preA) return 1;
  if (!preB) return -1;
  return preA < preB ? -1 : 1;
}
