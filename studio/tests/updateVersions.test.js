// Dua nomor versi terpisah (app vs content) dan guard minAppVersion pada check() + apply().
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildManifest, makeEnvironment, makeKeys, sign, startPayloadServer, rejectsWith } from './updateFixture.js';
import { verifyManifestSignature } from '../server/infra/updateKeys.js';

let srv;
before(async () => { srv = await startPayloadServer(); });
after(() => srv.close());

const ENDPOINT = () => `${srv.base}/doz-update.json`;
const P = (rel, content) => ({ path: `plugins/${rel}`, target: 'plugins', content });
function setInstalled(env, json) {
  fs.mkdirSync(env.config.userDataDir, { recursive: true });
  fs.writeFileSync(path.join(env.config.userDataDir, 'installed.json'), json);
}
const payloadHits = () => srv.hits.filter((h) => h.startsWith('/payload/'));

function publish(env, opts) {
  const files = opts.files ?? [P('agents/a.md', 'A1')];
  srv.publish({ manifest: buildManifest({ base: srv.base, files, ...opts }), files, privateKey: env.privateKey });
  env.service.setSettings({ endpoint: ENDPOINT() });
}

test('status: appVersion (binary) dan contentVersion (installed.json) terbaca terpisah', () => {
  const env = makeEnvironment();
  setInstalled(env, JSON.stringify({ version: '1.5.0', files: {} }));
  const st = env.service.status();
  assert.equal(st.appVersion, '1.20.0');
  assert.equal(st.contentVersion, '1.5.0');
  assert.equal('pluginVersion' in st, false);
  assert.equal('version' in st, false);
  assert.equal(env.service.contentVersion(), '1.5.0');
});

test('check: updateAvailable membandingkan content version, bukan app version', async () => {
  const env = makeEnvironment();
  // content terpasang 1.25.0 > app 1.20.0; manifest 1.22.0 lebih baru dari app tetapi lebih lama dari content.
  setInstalled(env, JSON.stringify({ version: '1.25.0', files: {} }));
  publish(env, { version: '1.22.0' });
  const data = await env.service.check();
  assert.equal(data.updateAvailable, false);
  assert.equal(data.currentContentVersion, '1.25.0');
  assert.equal(data.contentVersion, '1.22.0');
  await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_STALE_MANIFEST', 409);
});

test('check: content lebih lama dari app tetap dianggap update (tidak dibandingkan dengan app version)', async () => {
  const env = makeEnvironment();
  setInstalled(env, JSON.stringify({ version: '1.2.0', files: {} }));
  publish(env, { version: '1.3.0' });
  assert.equal((await env.service.check()).updateAvailable, true);
});

test('schema: manifest tanpa minAppVersion (ditandatangani valid) ditolak UPDATE_MANIFEST_INVALID', async () => {
  const env = makeEnvironment();
  const files = [P('agents/a.md', 'A1')];
  const { minAppVersion: _omit, ...legacy } = buildManifest({ base: srv.base, files });
  srv.set('/doz-update.json', JSON.stringify(sign(legacy, env.privateKey)), { headers: { 'content-type': 'application/json' } });
  await rejectsWith(env.service.check({ endpoint: ENDPOINT() }), 'UPDATE_MANIFEST_INVALID', 422);
});

test('signature: mengubah minAppVersion setelah ditandatangani merusak signature', () => {
  const { privateKey, keys } = makeKeys();
  const signed = sign({ schema: 1, contentVersion: '1.0.0', minAppVersion: '1.0.0', files: [] }, privateKey);
  assert.equal(verifyManifestSignature(signed, keys), true);
  assert.equal(verifyManifestSignature({ ...signed, minAppVersion: '0.0.1' }, keys), false);
});

test('check: app lebih lama dari minAppVersion → UPDATE_REQUIRES_NEW_APP dengan params + tanpa unduhan', async () => {
  const env = makeEnvironment();
  const before = payloadHits().length;
  publish(env, { minAppVersion: '1.21.0' });
  const e = await rejectsWith(env.service.check(), 'UPDATE_REQUIRES_NEW_APP', 422);
  assert.deepEqual(e.params, { minAppVersion: '1.21.0', appVersion: '1.20.0' });
  assert.match(e.message, /installer/i);
  assert.equal(payloadHits().length, before);
  assert.equal(env.service.status().available, null);
});

test('check: minAppVersion sama dengan app version lolos (batas inklusif)', async () => {
  const env = makeEnvironment();
  publish(env, { minAppVersion: '1.20.0' });
  assert.equal((await env.service.check()).updateAvailable, true);
});

test('apply: app version turun di bawah minAppVersion setelah check → ditolak sebelum unduhan, file tak berubah', async () => {
  const env = makeEnvironment();
  publish(env, { minAppVersion: '1.20.0' });
  await env.service.check();
  env.config.appVersion = '1.19.0'; // simulasi binary lebih lama dari yang dibutuhkan manifest di cache
  const before = payloadHits().length;
  const e = await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_REQUIRES_NEW_APP', 422);
  assert.deepEqual(e.params, { minAppVersion: '1.20.0', appVersion: '1.19.0' });
  assert.equal(payloadHits().length, before, 'tidak ada unduhan payload');
  assert.equal(env.exists('agents/a.md'), false);
  assert.equal(env.service.status().applying, false);
});

test('kompatibilitas: installed.json lama (kunci version) dan seed lama tetap terbaca', () => {
  const env = makeEnvironment();
  setInstalled(env, JSON.stringify({ version: '1.7.0', files: {} }));
  assert.equal(env.service.contentVersion(), '1.7.0');
  fs.rmSync(path.join(env.config.userDataDir, 'installed.json'));
  fs.writeFileSync(path.join(env.pluginDir, '.doz-seed.json'), JSON.stringify({ version: '1.6.0', seededAt: 1 }));
  assert.equal(env.service.contentVersion(), '1.6.0');
  fs.writeFileSync(path.join(env.pluginDir, '.doz-seed.json'), JSON.stringify({ contentVersion: '1.8.0', seededAt: 1 }));
  assert.equal(env.service.contentVersion(), '1.8.0');
});

test('apply di atas installed.json lama: ditulis ulang dengan contentVersion (tanpa kunci version); history lama dinormalkan', async () => {
  const env = makeEnvironment();
  setInstalled(env, JSON.stringify({ version: '1.7.0', files: {} }));
  env.config.mergeSaved({ update: { history: [{ version: '1.7.0', appliedAt: 1, files: 2, skipped: 0 }] } });
  publish(env, { version: '1.21.0' });
  await env.service.check();
  const res = await env.service.apply({ contentVersion: '1.21.0' });
  assert.equal(res.contentVersion, '1.21.0');
  assert.equal('version' in res, false);
  const inst = JSON.parse(fs.readFileSync(path.join(env.config.userDataDir, 'installed.json'), 'utf8'));
  assert.equal(inst.contentVersion, '1.21.0');
  assert.equal('version' in inst, false);
  const { history } = env.service.status();
  assert.deepEqual(history.map((h) => h.contentVersion), ['1.21.0', '1.7.0']);
  assert.ok(history.every((h) => !('version' in h)));
});

test('apply: body lama { version } ditolak validasi (kontrak baru contentVersion)', async () => {
  const { updateApplyBody } = await import('../server/http/schemas.js');
  assert.equal(updateApplyBody.safeParse({ version: '1.21.0' }).success, false);
  assert.equal(updateApplyBody.safeParse({ contentVersion: '1.21.0' }).success, true);
});
