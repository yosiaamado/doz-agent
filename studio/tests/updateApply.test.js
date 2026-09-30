// Applying an update: staging + checksums, local edits, backup, rollback, the active-run guard, the cache TTL, and the endpoint over HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildManifest, makeEnvironment, startPayloadServer, rejectsWith, sha256 } from './updateFixture.js';
import { startServer } from '../server/app.js';

let srv;
before(async () => { srv = await startPayloadServer(); });
after(() => srv.close());

const P = (rel, content, target = 'plugins') => ({ path: target === 'plugins' ? `plugins/${rel}` : rel, target, content });
const ENDPOINT = () => `${srv.base}/doz-update.json`;

async function release(env, { version, files, removed }) {
  srv.publish({ manifest: buildManifest({ version, base: srv.base, files, removed }), files, privateKey: env.privateKey });
  env.service.setSettings({ endpoint: ENDPOINT() }); // apply only uses the check result from the stored endpoint
  return env.service.check();
}
const installed = (env) => JSON.parse(fs.readFileSync(path.join(env.config.userDataDir, 'installed.json'), 'utf8'));

test('apply succeeds: the new files are installed, installed.json + history are recorded, reloadWeb for web assets, staging is clean', async () => {
  const env = makeEnvironment();
  const files = [P('agents/a.md', 'A1'), P('skills/s/SKILL.md', 'S1'), P('index.html', '<html>v2', 'web')];
  const check = await release(env, { version: '1.21.0', files });
  assert.equal(check.updateAvailable, true);
  assert.equal(env.service.status().available.contentVersion, '1.21.0');
  const res = await env.service.apply({ contentVersion: '1.21.0' });
  assert.equal(res.applied, 3);
  assert.deepEqual(res.skipped, []);
  assert.equal(res.reloadWeb, true);
  assert.equal(env.read('agents/a.md'), 'A1');
  assert.equal(env.read('skills/s/SKILL.md'), 'S1');
  assert.equal(fs.readFileSync(path.join(env.config.userDataDir, 'web', 'dist', 'index.html'), 'utf8'), '<html>v2');
  assert.equal(installed(env).contentVersion, '1.21.0');
  assert.equal(installed(env).files['plugins/plugins/agents/a.md'], sha256('A1'));
  assert.ok(!fs.existsSync(path.join(env.config.userDataDir, 'staging', '1.21.0')));
  const status = env.service.status();
  assert.equal(status.contentVersion, '1.21.0');
  assert.equal(status.available, null);
  assert.equal(status.history[0].contentVersion, '1.21.0');
  assert.equal(status.history[0].files, 3);
  // check again → already up to date
  assert.equal((await env.service.check()).updateAvailable, false);
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
});

test('apply without a check, a version mismatch, an expired cache, a downgrade → UPDATE_STALE_MANIFEST', async () => {
  let t = 1_000_000;
  const env = makeEnvironment({ clock: () => t });
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
  await release(env, { version: '1.21.0', files: [P('agents/a.md', 'A')] });
  await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_STALE_MANIFEST', 409);
  t += 16 * 60 * 1000;
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
  assert.ok(!env.exists('agents/a.md'));
  // an old manifest (validly signed) must not be able to lower the version
  const old = await release(env, { version: '1.0.0', files: [P('agents/a.md', 'OLD')] });
  assert.equal(old.updateAvailable, false);
  await rejectsWith(env.service.apply({ contentVersion: '1.0.0' }), 'UPDATE_STALE_MANIFEST', 409);
  assert.ok(!env.exists('agents/a.md'));
});

test('a checksum mismatch → no target file changes, and staging is cleaned up', async () => {
  const env = makeEnvironment();
  env.write('agents/existing.md', 'OLD');
  const files = [P('agents/existing.md', 'NEW'), P('agents/b.md', 'B')];
  await release(env, { version: '1.21.0', files });
  srv.set('/payload/plugins/plugins/agents/b.md', 'CONTENT-SWAPPED-BY-ATTACKER');
  const e = await rejectsWith(env.service.apply({ contentVersion: '1.21.0', overwriteLocalEdits: true }), 'UPDATE_CHECKSUM_MISMATCH', 422);
  assert.equal(e.params.path, 'plugins/agents/b.md');
  assert.equal(env.read('agents/existing.md'), 'OLD');
  assert.ok(!env.exists('agents/b.md'));
  assert.ok(!fs.existsSync(path.join(env.config.userDataDir, 'staging', '1.21.0')));
  assert.ok(!fs.existsSync(path.join(env.config.userDataDir, 'installed.json')));
  assert.equal(env.service.status().applying, false);
});

test('a body longer than the size in the manifest → failure (UPDATE_CHECKSUM_MISMATCH)', async () => {
  const env = makeEnvironment();
  await release(env, { version: '1.21.0', files: [P('agents/a.md', 'SHORT')] });
  srv.set('/payload/plugins/plugins/agents/a.md', 'SHORT-BUT-PADDED');
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_CHECKSUM_MISMATCH', 422);
  assert.ok(!env.exists('agents/a.md'));
});

test('a file the user edited is skipped and reported; overwrite=true makes a backup holding the user version', async () => {
  const env = makeEnvironment();
  await release(env, { version: '1.21.0', files: [P('agents/a.md', 'A1'), P('agents/b.md', 'B1')] });
  await env.service.apply({ contentVersion: '1.21.0' });

  env.write('agents/a.md', 'BUYER-EDIT');
  env.write('agents/mine.md', 'MY-OWN-FILE');
  const check = await release(env, { version: '1.22.0', files: [P('agents/a.md', 'A2'), P('agents/b.md', 'B2')] });
  assert.deepEqual(check.localEdits, [{ path: 'plugins/agents/a.md', target: 'plugins' }]);

  const skip = await env.service.apply({ contentVersion: '1.22.0', overwriteLocalEdits: false });
  assert.deepEqual(skip.skipped, [{ path: 'plugins/agents/a.md', target: 'plugins', reason: 'local-edit' }]);
  assert.equal(skip.applied, 1);
  assert.equal(env.read('agents/a.md'), 'BUYER-EDIT', 'the buyer edit is not lost');
  assert.equal(env.read('agents/b.md'), 'B2');
  assert.equal(env.read('agents/mine.md'), 'MY-OWN-FILE');

  // still detected as an edit, because the recorded hash is not replaced along with it
  const again = await release(env, { version: '1.23.0', files: [P('agents/a.md', 'A3'), P('agents/b.md', 'B3')] });
  assert.equal(again.localEdits.length, 1);
  const over = await env.service.apply({ contentVersion: '1.23.0', overwriteLocalEdits: true });
  assert.deepEqual(over.skipped, []);
  assert.equal(env.read('agents/a.md'), 'A3');
  assert.ok(over.backupDir);
  assert.equal(fs.readFileSync(path.join(over.backupDir, 'plugins', 'agents', 'a.md'), 'utf8'), 'BUYER-EDIT');
  assert.equal(fs.readFileSync(path.join(over.backupDir, 'plugins', 'agents', 'b.md'), 'utf8'), 'B2');
});

test('an existing file with no installed.json that is also in the manifest is treated as a local edit', async () => {
  const env = makeEnvironment();
  env.write('agents/a.md', 'USER-OWNED');
  const check = await release(env, { version: '1.21.0', files: [P('agents/a.md', 'NEW'), P('agents/n.md', 'N')] });
  assert.equal(check.localEdits.length, 1);
  const res = await env.service.apply({ contentVersion: '1.21.0' });
  assert.equal(env.read('agents/a.md'), 'USER-OWNED');
  assert.equal(env.read('agents/n.md'), 'N');
  assert.equal(res.skipped.length, 1);
});

test('untouched seeded files may be updated; the ones edited after seeding are protected; the rest are recorded', async () => {
  const env = makeEnvironment();
  env.write('agents/pristine.md', 'BUNDLED');
  env.write('agents/edited.md', 'BUNDLED');
  env.write('agents/untouched-other.md', 'OTHER');
  fs.writeFileSync(path.join(env.pluginDir, '.doz-seed.json'), JSON.stringify({ version: '1.20.0', seededAt: Date.now() + 2000 }));
  const future = new Date(Date.now() + 60_000);
  fs.writeFileSync(path.join(env.pluginDir, 'agents', 'edited.md'), 'EDIT-USER');
  fs.utimesSync(path.join(env.pluginDir, 'agents', 'edited.md'), future, future);
  const check = await release(env, { version: '1.21.0', files: [P('agents/pristine.md', 'NEW'), P('agents/edited.md', 'NEW')] });
  assert.deepEqual(check.localEdits.map((e) => e.path), ['plugins/agents/edited.md']);
  await env.service.apply({ contentVersion: '1.21.0' });
  assert.equal(env.read('agents/pristine.md'), 'NEW');
  assert.equal(env.read('agents/edited.md'), 'EDIT-USER');
  assert.equal(installed(env).files['plugins/plugins/agents/untouched-other.md'], sha256('OTHER'));
});

test('removed: a pristine file owned by the studio is deleted (with a backup), an edited one or one not owned by the studio is left alone', async () => {
  const env = makeEnvironment();
  await release(env, { version: '1.21.0', files: [P('agents/keep.md', 'K'), P('agents/old.md', 'OLD'), P('agents/old-edited.md', 'OLD2')] });
  await env.service.apply({ contentVersion: '1.21.0' });
  env.write('agents/old-edited.md', 'EDIT');
  env.write('agents/foreign.md', 'FOREIGN');
  const removed = ['agents/old.md', 'agents/old-edited.md', 'agents/foreign.md'].map((p) => ({ path: `plugins/${p}`, target: 'plugins' }));
  await release(env, { version: '1.22.0', files: [P('agents/keep.md', 'K2')], removed });
  const res = await env.service.apply({ contentVersion: '1.22.0' });
  assert.equal(res.removed, 1);
  assert.ok(!env.exists('agents/old.md'));
  assert.equal(env.read('agents/old-edited.md'), 'EDIT');
  assert.equal(env.read('agents/foreign.md'), 'FOREIGN');
  assert.deepEqual(res.skipped.map((s) => s.path), ['plugins/agents/old-edited.md']);
  assert.equal(fs.readFileSync(path.join(res.backupDir, 'plugins', 'agents', 'old.md'), 'utf8'), 'OLD');
  assert.ok(!('plugins/plugins/agents/old.md' in installed(env).files));
});

test('a failure halfway through the move → every file is rolled back, the backup is kept, UPDATE_APPLY_FAILED', async () => {
  const env = makeEnvironment();
  await release(env, { version: '1.21.0', files: [P('agents/pre.md', 'PRE1')] });
  await env.service.apply({ contentVersion: '1.21.0' });
  // "skills" is an ordinary file here, which makes creating skills/a/SKILL.md fail during the move.
  env.write('skills', 'NOT-A-FOLDER');
  await release(env, { version: '1.22.0', files: [P('agents/pre.md', 'PRE2'), P('agents/new.md', 'NEW'), P('skills/a/SKILL.md', 'X')] });
  const e = await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_APPLY_FAILED', 500);
  assert.equal(e.params.path, 'plugins/skills/a/SKILL.md');
  assert.equal(env.read('agents/pre.md'), 'PRE1');
  assert.ok(!env.exists('agents/new.md'));
  assert.equal(installed(env).contentVersion, '1.21.0');
  assert.ok(fs.readdirSync(path.join(env.config.userDataDir, 'backups')).length >= 1, 'the backup is not deleted');
  assert.ok(!fs.existsSync(path.join(env.config.userDataDir, 'staging', '1.22.0')));
  assert.equal(env.service.status().applying, false);
});

test('guard: an active run → UPDATE_BUSY_RUN; a second apply while the first is running → UPDATE_ALREADY_RUNNING', async () => {
  let busy = false;
  const env = makeEnvironment({ isRunActive: () => busy });
  await release(env, { version: '1.21.0', files: [P('agents/a.md', 'A')] });
  busy = true;
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_BUSY_RUN', 409);
  assert.ok(!env.exists('agents/a.md'));
  busy = false;
  const first = env.service.apply({ contentVersion: '1.21.0' });
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_ALREADY_RUNNING', 409);
  assert.equal((await first).applied, 1);
});

test('over HTTP: the status is always 200 even offline, a failed check → 503 UPDATE_UNREACHABLE, and settings refuse http', async () => {
  const previous = process.env.DOZ_UPDATE_ALLOW_HTTP;
  process.env.DOZ_UPDATE_ALLOW_HTTP = '1';
  const env = makeEnvironment();
  const quiet = { info() {}, warn() {}, error() {} };
  const started = await startServer({ config: env.config, port: 0, runners: { 'claude-cli': {}, api: {} }, runnerStatus: () => ({}), logger: quiet });
  const call = async (method, url, body) => {
    const res = await fetch(`${started.url}${url}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() };
  };
  try {
    const before = await call('GET', '/api/update/status');
    assert.equal(before.status, 200);
    assert.equal(before.json.data.lastResult, 'never');
    assert.equal(before.json.data.endpointIsDefault, true);

    const put = await call('PUT', '/api/update/settings', { endpoint: `${srv.base}/does-not-exist.json` });
    assert.equal(put.status, 200);
    assert.equal(put.json.data.endpointIsDefault, false);
    const offline = await call('POST', '/api/update/check', {});
    assert.equal(offline.status, 503);
    assert.equal(offline.json.code, 'UPDATE_UNREACHABLE');
    assert.equal(offline.json.params.status, 404);
    const after = await call('GET', '/api/update/status');
    assert.equal(after.status, 200);
    assert.equal(after.json.data.lastResult, 'error');

    const insecure = await call('PUT', '/api/update/settings', { endpoint: 'http://example.com/x.json' });
    assert.equal(insecure.status, 400);
    assert.equal(insecure.json.code, 'UPDATE_INSECURE_ENDPOINT');
    assert.equal((await call('PUT', '/api/update/settings', {})).json.code, 'VALIDATION_FAILED');
    assert.equal((await call('POST', '/api/update/apply', {})).json.code, 'VALIDATION_FAILED');
    assert.equal((await call('POST', '/api/update/apply', { contentVersion: '9.9.9' })).json.code, 'UPDATE_STALE_MANIFEST');
    assert.equal((await call('PUT', '/api/update/settings', { endpoint: null })).json.data.endpointIsDefault, true);
    // success over HTTP
    const files = [P('agents/http.md', 'H')];
    srv.publish({ manifest: buildManifest({ base: srv.base, files }), files, privateKey: env.privateKey });
    await call('PUT', '/api/update/settings', { endpoint: ENDPOINT() });
    // the test key is not a built-in key → the manifest is rejected over the HTTP path too (fail closed)
    const rejected = await call('POST', '/api/update/check', {});
    assert.equal(rejected.status, 422);
    assert.equal(rejected.json.code, 'UPDATE_SIGNATURE_INVALID');
  } finally {
    await new Promise((r) => started.server.close(r));
    if (previous === undefined) delete process.env.DOZ_UPDATE_ALLOW_HTTP;
    else process.env.DOZ_UPDATE_ALLOW_HTTP = previous;
  }
});

test('a partially failed rollback is reported as UPDATE_ROLLBACK_INCOMPLETE with backupDir, not UPDATE_APPLY_FAILED', async () => {
  const env = makeEnvironment({ serviceOptions: { restoreFile: () => { throw new Error('disk full'); } } });
  await release(env, { version: '1.21.0', files: [P('agents/pre.md', 'PRE1')] });
  await env.service.apply({ contentVersion: '1.21.0' });
  env.write('skills', 'NOT-A-FOLDER'); // makes the third file fail during the move
  await release(env, { version: '1.22.0', files: [P('agents/pre.md', 'PRE2'), P('agents/new.md', 'NEW'), P('skills/a/SKILL.md', 'X')] });
  const e = await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_ROLLBACK_INCOMPLETE', 500);
  assert.equal(e.params.failed, 1, 'only pre.md failed to restore; new.md was deleted successfully');
  assert.ok(fs.existsSync(e.params.backupDir));
  assert.equal(fs.readFileSync(path.join(e.params.backupDir, 'plugins', 'agents', 'pre.md'), 'utf8'), 'PRE1', 'the original version is safe in the backup');
  assert.equal(env.read('agents/pre.md'), 'PRE2', 'a mix of versions: exactly what has to be restored by hand');
  assert.ok(!env.exists('agents/new.md'));
  assert.equal(installed(env).contentVersion, '1.21.0', 'installed.json does not move forward');
  assert.equal(env.service.status().applying, false);
});
