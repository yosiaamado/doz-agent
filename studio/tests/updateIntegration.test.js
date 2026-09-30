// FE↔BE update integration: the real client `web/src/lib/api.js` against the real routes + service (with a test key injected),
// plus the migrated config interaction, webDist after an update, and the apply order/limits.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { buildManifest, makeEnvironment, startPayloadServer } from './updateFixture.js';
import { Router } from '../server/http/router.js';
import { readJsonBody } from '../server/http/middleware.js';
import { sendSuccess, sendError } from '../server/http/respond.js';
import { createStaticHandler } from '../server/http/static.js';
import { registerUpdateRoutes } from '../server/routes/updateRoutes.js';
import { createUpdateService } from '../server/services/updateService.js';
import { createConfig } from '../server/infra/config.js';
import { api } from '../web/src/lib/api.js';

let srv;
const realFetch = globalThis.fetch;
before(async () => { srv = await startPayloadServer(); });
after(() => { globalThis.fetch = realFetch; return srv.close(); });

const P = (rel, content, target = 'plugins') => ({ path: target === 'plugins' ? `plugins/${rel}` : rel, target, content });
const ENDPOINT = () => `${srv.base}/doz-update.json`;
const quiet = { info() {}, warn() {}, error() {} };

// Mimics the app.js composition root (router + envelope + static per request), but with a test key.
async function mount(env) {
  const service = createUpdateService({ config: env.config, env: { DOZ_UPDATE_ALLOW_HTTP: '1', NODE_ENV: 'test' }, keys: env.keys });
  const router = new Router();
  registerUpdateRoutes(router, { update: service });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) return createStaticHandler(env.config.webDist, env.config.webOverlay)(req, res, url);
      const { handler, params } = router.resolve(req.method, url.pathname);
      const body = ['POST', 'PUT'].includes(req.method) ? await readJsonBody(req) : undefined;
      return sendSuccess(res, await handler({ params, body, query: {} }));
    } catch (e) { return sendError(res, e); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = (u, init) => realFetch(String(u).startsWith('/') ? base + u : u, init);
  return { base, service, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}
function publish(env, { version, files, removed }) {
  srv.publish({ manifest: buildManifest({ version, base: srv.base, files, removed }), files, privateKey: env.privateKey });
}
const rejects = (p, code) => assert.rejects(p, (e) => { assert.equal(e.name, 'ApiRequestError'); assert.equal(e.code, code); return true; });

test('FE api.js and the routes: the status/check/apply/settings shapes are exactly what UpdateDialog and useUpdate read', async () => {
  const env = makeEnvironment();
  const app = await mount(env);
  try {
    const st0 = await api.updateStatus();
    for (const k of ['appVersion', 'contentVersion', 'endpoint', 'endpointIsDefault', 'lastCheckedAt', 'lastResult', 'available', 'applying', 'history']) assert.ok(k in st0, `status.${k}`);
    assert.equal(st0.lastResult, 'never');

    env.write('agents/a.md', 'EDITED-BY-USER');
    publish(env, { version: '1.21.0', files: [P('agents/a.md', 'A2'), P('agents/b.md', 'B1'), P('index.html', '<html>2', 'web')] });
    await api.saveUpdateSettings(ENDPOINT());
    const chk = await api.updateCheck();
    assert.equal(chk.updateAvailable, true);
    assert.equal(typeof chk.notes.en, 'string');
    assert.equal(chk.fileCount, 3);
    assert.equal(typeof chk.totalBytes, 'number');
    assert.equal(chk.currentContentVersion, '1.20.0');
    assert.deepEqual(chk.localEdits, [{ path: 'plugins/agents/a.md', target: 'plugins' }]);
    assert.equal((await api.updateStatus()).available.contentVersion, '1.21.0');

    const res = await api.updateApply({ contentVersion: chk.contentVersion, overwriteLocalEdits: false });
    assert.equal(res.applied, 2);
    assert.deepEqual(res.skipped, [{ path: 'plugins/agents/a.md', target: 'plugins', reason: 'local-edit' }]);
    assert.equal(res.reloadWeb, true);
    assert.equal(res.removed, 0);
    assert.equal(env.read('agents/a.md'), 'EDITED-BY-USER');
    const st1 = await api.updateStatus();
    assert.equal(st1.contentVersion, '1.21.0');
    assert.equal(st1.history[0].skipped, 1);
  } finally { await app.close(); }
});

test('AC-9 through the client: overwriteLocalEdits=true overwrites the edited file and the backup holds the edited contents', async () => {
  const env = makeEnvironment();
  const app = await mount(env);
  try {
    env.write('agents/a.md', 'EDITED');
    publish(env, { version: '1.21.0', files: [P('agents/a.md', 'A2')] });
    await api.saveUpdateSettings(ENDPOINT());
    await api.updateCheck();
    const res = await api.updateApply({ contentVersion: '1.21.0', overwriteLocalEdits: true });
    assert.deepEqual(res.skipped, []);
    assert.equal(env.read('agents/a.md'), 'A2');
    assert.equal(fs.readFileSync(path.join(res.backupDir, 'plugins', 'agents', 'a.md'), 'utf8'), 'EDITED');
  } finally { await app.close(); }
});

test('ordering: apply without a check, apply twice, an older manifest, the endpoint changed midway — all STALE', async () => {
  const env = makeEnvironment();
  const app = await mount(env);
  try {
    await rejects(api.updateApply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST');
    publish(env, { version: '1.21.0', files: [P('agents/a.md', 'A')] });
    await api.saveUpdateSettings(ENDPOINT());
    await api.updateCheck();
    await api.updateApply({ contentVersion: '1.21.0' });
    await rejects(api.updateApply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST');

    publish(env, { version: '1.19.0', files: [P('agents/a.md', 'OLD')] });
    const older = await api.updateCheck();
    assert.equal(older.updateAvailable, false);
    await rejects(api.updateApply({ contentVersion: '1.19.0' }), 'UPDATE_STALE_MANIFEST');
    assert.equal(env.read('agents/a.md'), 'A');

    publish(env, { version: '1.22.0', files: [P('agents/c.md', 'C')] });
    await api.updateCheck();
    srv.set('/other.json', '{}');
    await api.saveUpdateSettings(`${srv.base}/other.json`);
    await rejects(api.updateApply({ contentVersion: '1.22.0' }), 'UPDATE_STALE_MANIFEST');
    assert.ok(!env.exists('agents/c.md'));
  } finally { await app.close(); }
});

test('invalid input from the client: VALIDATION_FAILED / UPDATE_INSECURE_ENDPOINT', async () => {
  const env = makeEnvironment();
  const app = await mount(env);
  try {
    await rejects(api.updateApply({ contentVersion: 'latest' }), 'VALIDATION_FAILED');
    await rejects(api.updateApply({ contentVersion: '1.21.0', overwriteLocalEdits: 'yes' }), 'VALIDATION_FAILED');
    await rejects(api.saveUpdateSettings(''), 'VALIDATION_FAILED');
    await rejects(api.saveUpdateSettings('http://evil.example/x.json'), 'UPDATE_INSECURE_ENDPOINT');
  } finally { await app.close(); }
});

test('a config produced by the .local.json migration stays intact through check and apply', async () => {
  const env = makeEnvironment();
  const studioDir = path.join(env.tmp, 'studio');
  fs.writeFileSync(path.join(studioDir, '.local.json'), JSON.stringify({ anthropicApiKey: 'sk-test', setup: { completed: true }, sources: [{ path: 'x' }], workdir: path.join(env.tmp, 'work') }));
  const here = path.join(studioDir, 'server', 'infra');
  const config = createConfig({ argv: ['node', 'x'], env: { DOZ_USER_DATA_DIR: path.join(env.tmp, 'ud2'), DOZ_PLUGIN_DIR: env.pluginDir, DOZ_RESOURCES_DIR: path.join(env.tmp, 'res') }, here, logger: quiet });
  const app = await mount({ ...env, config });
  try {
    publish(env, { version: '1.21.0', files: [P('agents/a.md', 'A')] });
    await api.saveUpdateSettings(ENDPOINT());
    await api.updateCheck();
    await api.updateApply({ contentVersion: '1.21.0' });
    const saved = JSON.parse(fs.readFileSync(path.join(config.userDataDir, 'config.json'), 'utf8'));
    assert.equal(saved.anthropicApiKey, 'sk-test');
    assert.deepEqual(saved.setup, { completed: true });
    assert.equal(saved.sources.length, 1);
    assert.equal(saved.update.endpoint, ENDPOINT());
    assert.equal(saved.update.history[0].contentVersion, '1.21.0');
  } finally { await app.close(); }
});

function withBundle(env) {
  const bundle = path.join(env.tmp, 'res', 'web', 'dist');
  fs.mkdirSync(path.join(bundle, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(bundle, 'index.html'), '<html>bundle');
  fs.writeFileSync(path.join(bundle, 'assets', 'vendor.js'), 'VENDOR');
}

test('the userData/web/dist overlay: new assets from an update are served without a restart', async () => {
  const env = makeEnvironment();
  withBundle(env);
  const app = await mount(env);
  try {
    assert.equal(await (await realFetch(`${app.base}/`)).text(), '<html>bundle');
    publish(env, { version: '1.21.0', files: [P('index.html', '<html>v2', 'web'), P('assets/app-2.js', 'APP2', 'web')] });
    await api.saveUpdateSettings(ENDPOINT());
    await api.updateCheck();
    await api.updateApply({ contentVersion: '1.21.0' });
    assert.match(await (await realFetch(`${app.base}/`)).text(), /v2/);
    assert.equal(await (await realFetch(`${app.base}/assets/app-2.js`)).text(), 'APP2');
  } finally { await app.close(); }
});

test('QA: a partial web update (only the changed files) must not make the older bundle assets disappear', async () => {
  const env = makeEnvironment();
  withBundle(env);
  const app = await mount(env);
  try {
    publish(env, { version: '1.21.0', files: [P('index.html', '<html>v2', 'web')] });
    await api.saveUpdateSettings(ENDPOINT());
    await api.updateCheck();
    await api.updateApply({ contentVersion: '1.21.0' });
    const res = await realFetch(`${app.base}/assets/vendor.js`);
    assert.equal(await res.text(), 'VENDOR');
  } finally { await app.close(); }
});
