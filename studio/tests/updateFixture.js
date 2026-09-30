// Test helpers for updates: a temporary keypair, a signed manifest, and a local HTTP server that serves the payload.
// Every key is generated inside the test; no real key lives in the repo.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createConfig } from '../server/infra/config.js';
import { canonicalJson, manifestPayload } from '../server/infra/updateKeys.js';
import { createUpdateService } from '../server/services/updateService.js';

export const KEY_ID = 'test-key';
const quiet = { info() {}, warn() {}, error() {} };

export function makeKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { privateKey, keys: { [KEY_ID]: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') } };
}

export function sign(manifest, privateKey, keyId = KEY_ID) {
  const value = crypto.sign(null, manifestPayload(manifest), privateKey).toString('base64');
  return { ...manifest, signature: { alg: 'ed25519', keyId, value } };
}

export const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');
export { canonicalJson };

// files: [{ path, target, content }] → manifest entries with the url payload/<target>/<path>.
export function buildManifest({ version = '1.21.0', minAppVersion = '1.0.0', base, files, removed, extra = {} }) {
  return {
    schema: 1,
    contentVersion: version,
    minAppVersion,
    releasedAt: '2026-09-20T02:00:00Z',
    notes: { en: '- change', id: '- perubahan' },
    baseUrl: `${base}/payload/`,
    files: files.map((f) => ({ path: f.path, target: f.target, url: `${f.target}/${f.path}`, size: Buffer.byteLength(f.content), sha256: sha256(f.content) })),
    ...(removed ? { removed } : {}),
    ...extra,
  };
}

export async function startPayloadServer() {
  const routes = new Map(); // pathname → { status, body, headers }
  const hits = [];
  const server = http.createServer(async (req, res) => {
    hits.push(req.url);
    const r = routes.get(req.url);
    if (!r) { res.writeHead(404); res.end('nope'); return; }
    await r.before?.(); // a test hook: e.g. changing the disk midway through the download
    res.writeHead(r.status ?? 200, r.headers ?? {});
    res.end(r.body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    hits,
    set: (pathname, body, extra = {}) => routes.set(pathname, { body, ...extra }),
    // Serve the signed manifest plus its payload files.
    publish({ manifest, files, privateKey, endpoint = '/doz-update.json' }) {
      routes.set(endpoint, { body: JSON.stringify(sign(manifest, privateKey)), headers: { 'content-type': 'application/json' } });
      for (const f of files) routes.set(`/payload/${f.target}/${f.path}`, { body: f.content });
    },
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }),
  };
}

export function makeEnvironment({ isRunActive = () => false, clock, serviceOptions = {} } = {}) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-upd-')));
  const pluginDir = path.join(tmp, 'plugins');
  fs.mkdirSync(path.join(pluginDir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'work'));
  // DOZ_RESOURCES_DIR forces packaged mode so the real repo is never touched.
  const env = { DOZ_USER_DATA_DIR: path.join(tmp, 'ud'), DOZ_PLUGIN_DIR: pluginDir, DOZ_RESOURCES_DIR: path.join(tmp, 'res') };
  // A fake studio: the tests must never read/migrate the real studio .local.json.
  const here = path.join(tmp, 'studio', 'server', 'infra');
  fs.mkdirSync(here, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'studio', 'package.json'), JSON.stringify({ version: '1.20.0' }));
  const config = createConfig({ argv: ['node', 'x', '--workdir', path.join(tmp, 'work')], env, here, logger: quiet });
  const { privateKey, keys } = makeKeys();
  const service = createUpdateService({ config, isRunActive, env: { DOZ_UPDATE_ALLOW_HTTP: '1', NODE_ENV: 'test' }, keys, ...(clock ? { now: clock } : {}), ...serviceOptions });
  const write = (rel, content) => {
    const file = path.join(pluginDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  };
  return { tmp, pluginDir, config, service, privateKey, keys, write, read: (rel) => fs.readFileSync(path.join(pluginDir, rel), 'utf8'), exists: (rel) => fs.existsSync(path.join(pluginDir, rel)) };
}

export async function rejectsWith(promiseOrFn, code, status) {
  try {
    await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn);
  } catch (e) {
    if (e.code !== code || (status && e.status !== status)) throw new Error(`expected ${code}${status ? `/${status}` : ''}, got ${e.code}/${e.status}: ${e.message}`);
    return e;
  }
  throw new Error(`expected the error ${code}, but nothing was thrown`);
}
