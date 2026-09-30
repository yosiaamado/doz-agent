// Apply update: staging + checksum, edit lokal, backup, rollback, guard run aktif, cache TTL, dan endpoint via HTTP.
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
  env.service.setSettings({ endpoint: ENDPOINT() }); // apply hanya memakai hasil cek dari endpoint tersimpan
  return env.service.check();
}
const installed = (env) => JSON.parse(fs.readFileSync(path.join(env.config.userDataDir, 'installed.json'), 'utf8'));

test('apply sukses: file baru terpasang, installed.json + history tercatat, reloadWeb untuk aset web, staging bersih', async () => {
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
  // cek ulang → sudah terbaru
  assert.equal((await env.service.check()).updateAvailable, false);
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
});

test('apply tanpa check, versi tidak cocok, cache kedaluwarsa, downgrade → UPDATE_STALE_MANIFEST', async () => {
  let t = 1_000_000;
  const env = makeEnvironment({ clock: () => t });
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
  await release(env, { version: '1.21.0', files: [P('agents/a.md', 'A')] });
  await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_STALE_MANIFEST', 409);
  t += 16 * 60 * 1000;
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
  assert.ok(!env.exists('agents/a.md'));
  // manifest lama (bertanda tangan valid) tidak boleh menurunkan versi
  const old = await release(env, { version: '1.0.0', files: [P('agents/a.md', 'OLD')] });
  assert.equal(old.updateAvailable, false);
  await rejectsWith(env.service.apply({ contentVersion: '1.0.0' }), 'UPDATE_STALE_MANIFEST', 409);
  assert.ok(!env.exists('agents/a.md'));
});

test('checksum tidak cocok → tidak ada file target berubah, staging dibersihkan', async () => {
  const env = makeEnvironment();
  env.write('agents/existing.md', 'LAMA');
  const files = [P('agents/existing.md', 'BARU'), P('agents/b.md', 'B')];
  await release(env, { version: '1.21.0', files });
  srv.set('/payload/plugins/plugins/agents/b.md', 'ISI-DIGANTI-PENYERANG');
  const e = await rejectsWith(env.service.apply({ contentVersion: '1.21.0', overwriteLocalEdits: true }), 'UPDATE_CHECKSUM_MISMATCH', 422);
  assert.equal(e.params.path, 'plugins/agents/b.md');
  assert.equal(env.read('agents/existing.md'), 'LAMA');
  assert.ok(!env.exists('agents/b.md'));
  assert.ok(!fs.existsSync(path.join(env.config.userDataDir, 'staging', '1.21.0')));
  assert.ok(!fs.existsSync(path.join(env.config.userDataDir, 'installed.json')));
  assert.equal(env.service.status().applying, false);
});

test('body lebih panjang dari size di manifest → gagal (UPDATE_CHECKSUM_MISMATCH)', async () => {
  const env = makeEnvironment();
  await release(env, { version: '1.21.0', files: [P('agents/a.md', 'PENDEK')] });
  srv.set('/payload/plugins/plugins/agents/a.md', 'PENDEK-TAPI-DIPANJANGKAN');
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_CHECKSUM_MISMATCH', 422);
  assert.ok(!env.exists('agents/a.md'));
});

test('file yang diedit user di-skip dan dilaporkan; overwrite=true membuat backup berisi versi user', async () => {
  const env = makeEnvironment();
  await release(env, { version: '1.21.0', files: [P('agents/a.md', 'A1'), P('agents/b.md', 'B1')] });
  await env.service.apply({ contentVersion: '1.21.0' });

  env.write('agents/a.md', 'EDIT-PEMBELI');
  env.write('agents/mine.md', 'BUATAN-SENDIRI');
  const check = await release(env, { version: '1.22.0', files: [P('agents/a.md', 'A2'), P('agents/b.md', 'B2')] });
  assert.deepEqual(check.localEdits, [{ path: 'plugins/agents/a.md', target: 'plugins' }]);

  const skip = await env.service.apply({ contentVersion: '1.22.0', overwriteLocalEdits: false });
  assert.deepEqual(skip.skipped, [{ path: 'plugins/agents/a.md', target: 'plugins', reason: 'local-edit' }]);
  assert.equal(skip.applied, 1);
  assert.equal(env.read('agents/a.md'), 'EDIT-PEMBELI', 'edit pembeli tidak hilang');
  assert.equal(env.read('agents/b.md'), 'B2');
  assert.equal(env.read('agents/mine.md'), 'BUATAN-SENDIRI');

  // masih terdeteksi sebagai edit karena hash tercatat tidak ikut diganti
  const again = await release(env, { version: '1.23.0', files: [P('agents/a.md', 'A3'), P('agents/b.md', 'B3')] });
  assert.equal(again.localEdits.length, 1);
  const over = await env.service.apply({ contentVersion: '1.23.0', overwriteLocalEdits: true });
  assert.deepEqual(over.skipped, []);
  assert.equal(env.read('agents/a.md'), 'A3');
  assert.ok(over.backupDir);
  assert.equal(fs.readFileSync(path.join(over.backupDir, 'plugins', 'agents', 'a.md'), 'utf8'), 'EDIT-PEMBELI');
  assert.equal(fs.readFileSync(path.join(over.backupDir, 'plugins', 'agents', 'b.md'), 'utf8'), 'B2');
});

test('file yang sudah ada tanpa installed.json dan ada di manifest diperlakukan sebagai edit lokal', async () => {
  const env = makeEnvironment();
  env.write('agents/a.md', 'PUNYA-USER');
  const check = await release(env, { version: '1.21.0', files: [P('agents/a.md', 'BARU'), P('agents/n.md', 'N')] });
  assert.equal(check.localEdits.length, 1);
  const res = await env.service.apply({ contentVersion: '1.21.0' });
  assert.equal(env.read('agents/a.md'), 'PUNYA-USER');
  assert.equal(env.read('agents/n.md'), 'N');
  assert.equal(res.skipped.length, 1);
});

test('hasil seeding yang belum disentuh boleh diperbarui; yang diedit setelah seeding dilindungi; sisanya dicatat', async () => {
  const env = makeEnvironment();
  env.write('agents/pristine.md', 'BAWAAN');
  env.write('agents/edited.md', 'BAWAAN');
  env.write('agents/untouched-other.md', 'LAIN');
  fs.writeFileSync(path.join(env.pluginDir, '.doz-seed.json'), JSON.stringify({ version: '1.20.0', seededAt: Date.now() + 2000 }));
  const future = new Date(Date.now() + 60_000);
  fs.writeFileSync(path.join(env.pluginDir, 'agents', 'edited.md'), 'EDIT-USER');
  fs.utimesSync(path.join(env.pluginDir, 'agents', 'edited.md'), future, future);
  const check = await release(env, { version: '1.21.0', files: [P('agents/pristine.md', 'BARU'), P('agents/edited.md', 'BARU')] });
  assert.deepEqual(check.localEdits.map((e) => e.path), ['plugins/agents/edited.md']);
  await env.service.apply({ contentVersion: '1.21.0' });
  assert.equal(env.read('agents/pristine.md'), 'BARU');
  assert.equal(env.read('agents/edited.md'), 'EDIT-USER');
  assert.equal(installed(env).files['plugins/plugins/agents/untouched-other.md'], sha256('LAIN'));
});

test('removed: file asli milik studio dihapus (dengan backup), yang diedit atau bukan milik studio tidak disentuh', async () => {
  const env = makeEnvironment();
  await release(env, { version: '1.21.0', files: [P('agents/keep.md', 'K'), P('agents/old.md', 'OLD'), P('agents/old-edited.md', 'OLD2')] });
  await env.service.apply({ contentVersion: '1.21.0' });
  env.write('agents/old-edited.md', 'EDIT');
  env.write('agents/foreign.md', 'ASING');
  const removed = ['agents/old.md', 'agents/old-edited.md', 'agents/foreign.md'].map((p) => ({ path: `plugins/${p}`, target: 'plugins' }));
  await release(env, { version: '1.22.0', files: [P('agents/keep.md', 'K2')], removed });
  const res = await env.service.apply({ contentVersion: '1.22.0' });
  assert.equal(res.removed, 1);
  assert.ok(!env.exists('agents/old.md'));
  assert.equal(env.read('agents/old-edited.md'), 'EDIT');
  assert.equal(env.read('agents/foreign.md'), 'ASING');
  assert.deepEqual(res.skipped.map((s) => s.path), ['plugins/agents/old-edited.md']);
  assert.equal(fs.readFileSync(path.join(res.backupDir, 'plugins', 'agents', 'old.md'), 'utf8'), 'OLD');
  assert.ok(!('plugins/plugins/agents/old.md' in installed(env).files));
});

test('gagal di tengah pemindahan → rollback semua file, backup dipertahankan, UPDATE_APPLY_FAILED', async () => {
  const env = makeEnvironment();
  await release(env, { version: '1.21.0', files: [P('agents/pre.md', 'PRE1')] });
  await env.service.apply({ contentVersion: '1.21.0' });
  // "skills" adalah file biasa, sehingga membuat skills/a/SKILL.md gagal saat pemindahan.
  env.write('skills', 'BUKAN-FOLDER');
  await release(env, { version: '1.22.0', files: [P('agents/pre.md', 'PRE2'), P('agents/new.md', 'NEW'), P('skills/a/SKILL.md', 'X')] });
  const e = await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_APPLY_FAILED', 500);
  assert.equal(e.params.path, 'plugins/skills/a/SKILL.md');
  assert.equal(env.read('agents/pre.md'), 'PRE1');
  assert.ok(!env.exists('agents/new.md'));
  assert.equal(installed(env).contentVersion, '1.21.0');
  assert.ok(fs.readdirSync(path.join(env.config.userDataDir, 'backups')).length >= 1, 'backup tidak dihapus');
  assert.ok(!fs.existsSync(path.join(env.config.userDataDir, 'staging', '1.22.0')));
  assert.equal(env.service.status().applying, false);
});

test('guard: run aktif → UPDATE_BUSY_RUN; apply kedua saat yang pertama jalan → UPDATE_ALREADY_RUNNING', async () => {
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

test('via HTTP: status selalu 200 walau offline, check gagal → 503 UPDATE_UNREACHABLE, settings tolak http', async () => {
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

    const put = await call('PUT', '/api/update/settings', { endpoint: `${srv.base}/tidak-ada.json` });
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
    // sukses lewat HTTP
    const files = [P('agents/http.md', 'H')];
    srv.publish({ manifest: buildManifest({ base: srv.base, files }), files, privateKey: env.privateKey });
    await call('PUT', '/api/update/settings', { endpoint: ENDPOINT() });
    // kunci uji bukan kunci bawaan → manifest ditolak lewat jalur HTTP juga (fail closed)
    const rejected = await call('POST', '/api/update/check', {});
    assert.equal(rejected.status, 422);
    assert.equal(rejected.json.code, 'UPDATE_SIGNATURE_INVALID');
  } finally {
    await new Promise((r) => started.server.close(r));
    if (previous === undefined) delete process.env.DOZ_UPDATE_ALLOW_HTTP;
    else process.env.DOZ_UPDATE_ALLOW_HTTP = previous;
  }
});

test('rollback yang gagal sebagian dilaporkan sebagai UPDATE_ROLLBACK_INCOMPLETE dengan backupDir, bukan UPDATE_APPLY_FAILED', async () => {
  const env = makeEnvironment({ serviceOptions: { restoreFile: () => { throw new Error('disk penuh'); } } });
  await release(env, { version: '1.21.0', files: [P('agents/pre.md', 'PRE1')] });
  await env.service.apply({ contentVersion: '1.21.0' });
  env.write('skills', 'BUKAN-FOLDER'); // membuat file ketiga gagal saat dipindah
  await release(env, { version: '1.22.0', files: [P('agents/pre.md', 'PRE2'), P('agents/new.md', 'NEW'), P('skills/a/SKILL.md', 'X')] });
  const e = await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_ROLLBACK_INCOMPLETE', 500);
  assert.equal(e.params.failed, 1, 'hanya pre.md yang gagal dipulihkan; new.md berhasil dihapus');
  assert.ok(fs.existsSync(e.params.backupDir));
  assert.equal(fs.readFileSync(path.join(e.params.backupDir, 'plugins', 'agents', 'pre.md'), 'utf8'), 'PRE1', 'versi asli aman di backup');
  assert.equal(env.read('agents/pre.md'), 'PRE2', 'campuran versi: itulah yang harus dipulihkan manual');
  assert.ok(!env.exists('agents/new.md'));
  assert.equal(installed(env).contentVersion, '1.21.0', 'installed.json tidak maju');
  assert.equal(env.service.status().applying, false);
});
