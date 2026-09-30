import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../web/src/i18n/locales/en.json' with { type: 'json' };
import id from '../web/src/i18n/locales/id.json' with { type: 'json' };
import { translate, kebabFromCode } from '../web/src/i18n/index.js';
import { errorMessage, codeText, checkDetail, nodeActivityText, nodeErrorText } from '../web/src/lib/errorMessage.js';
import { ApiRequestError, api } from '../web/src/lib/api.js';
import { reduceRun, emptyRun } from '../web/src/lib/model.js';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tEn = (k, v) => translate('en', k, v);
const tId = (k, v) => translate('id', k, v);

function sources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Semua kode SCREAMING_SNAKE yang server kirim (code/errorCode/fixCode/activityCode/warningCode/CodedError/err()/fail()).
function serverCodes() {
  const found = new Set();
  const context = /code|Code|CodedError|\berr\(|\bfail\(|\bresult\(/;
  for (const file of sources(path.join(STUDIO, 'server'))) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!context.test(line)) continue;
      for (const m of line.matchAll(/['"]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"]/g)) found.add(m[1]);
    }
  }
  return [...found].sort();
}

const CODE_PREFIXES = ['error', 'logs.code', 'runner.code', 'setup.code', 'setup.fix'];
// Env var / konstanta yang kebetulan satu baris dengan kode, bukan kode untuk UI.
const NOT_UI_CODES = new Set([
  'DOZ_UPDATE_ALLOW_HTTP', 'DOZ_STUDIO_PORT', 'DOZ_USER_DATA_DIR', 'DOZ_PLUGIN_DIR', 'DOZ_WEB_DIST', 'DOZ_RESOURCES_DIR', 'DOZ_WORKDIR',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN',
]);

test('semua kode dari server punya terjemahan di en dan id', () => {
  const codes = serverCodes().filter((c) => !NOT_UI_CODES.has(c));
  assert.ok(codes.length > 60, `terlalu sedikit kode ditemukan: ${codes.length}`);
  const missing = codes.filter((code) => {
    const kebab = kebabFromCode(code);
    return !CODE_PREFIXES.some((p) => en[`${p}.${kebab}`] && id[`${p}.${kebab}`]);
  });
  assert.deepEqual(missing, []);
});

test('kode update lengkap dan pesan signature menjelaskan penyebab (fail closed)', () => {
  for (const code of ['INSECURE_ENDPOINT', 'BUSY_RUN', 'ALREADY_RUNNING', 'STALE_MANIFEST', 'SIGNATURE_INVALID', 'SCHEMA_UNSUPPORTED',
    'MANIFEST_INVALID', 'PATH_REJECTED', 'CHECKSUM_MISMATCH', 'MANIFEST_TOO_LARGE', 'REQUIRES_NEW_APP', 'UNREACHABLE', 'APPLY_FAILED']) {
    const key = `error.update-${kebabFromCode(code)}`;
    assert.ok(en[key] && id[key], key);
  }
  const err = new ApiRequestError('Update manifest signature is not valid', { code: 'UPDATE_SIGNATURE_INVALID' });
  assert.match(errorMessage(tEn, err), /signature could not be verified.*signing key/);
  const off = new ApiRequestError('Cannot reach the update server', { code: 'UPDATE_UNREACHABLE', params: { status: 404 } });
  assert.match(errorMessage(tEn, off), /keeps working normally/);
});

test('setup: code + params diterjemahkan, target/source dipetakan, fixCode vs perintah mentah', () => {
  assert.equal(checkDetail(tEn, { code: 'REPO_NOT_GIT', params: { target: 'repo' }, detail: 'raw' }), 'doz-agent repo is not a git repository (per-node diff and GitHub sync are unavailable)');
  assert.match(checkDetail(tId, { code: 'REPO_NO_ORIGIN', params: { target: 'workdir' }, detail: 'raw' }), /^Repo project tidak punya remote origin/);
  assert.equal(checkDetail(tEn, { code: 'API_KEY_SET', params: { source: 'studio' }, detail: 'raw' }), 'API key is set (saved in the studio)');
  assert.equal(checkDetail(tEn, { detail: 'Node 20' }), 'Node 20', 'tanpa kode: teks server apa adanya');
  assert.equal(codeText(tId, 'setup.fix', 'FIX_INSTALL_GIT', undefined, 'x'), 'Pasang git dari git-scm.com');
  assert.equal(codeText(tEn, 'setup.fix', undefined, undefined, 'git init && git remote add origin <url>'), 'git init && git remote add origin <url>');
});

test('activity: activityCode diterjemahkan, null = teks apa adanya, activity kosong = tidak ada teks', () => {
  let run = emptyRun('r');
  run = reduceRun(run, { type: 'node', node: 'n', status: 'running', activity: 'Judging: ok?', activityCode: 'ACTIVITY_JUDGING', ts: 1 });
  run.nodes.n.activityParams = { check: 'ok?' };
  assert.equal(nodeActivityText(tId, run.nodes.n), 'Menilai: ok?');
  run = reduceRun(run, { type: 'node', node: 'n', activity: 'Reading file', ts: 2 });
  assert.equal(run.nodes.n.activityCode, null, 'kode lama tidak menempel');
  assert.equal(nodeActivityText(tId, run.nodes.n), 'Reading file');
  run = reduceRun(run, { type: 'node', node: 'n', activity: null, activityCode: null, ts: 3 });
  assert.equal(nodeActivityText(tEn, run.nodes.n), '');
  run = reduceRun(run, { type: 'activity', node: 'n', kind: 'retry', text: 'Failed, retrying (x)', code: 'ACTIVITY_RETRY', params: { reason: 'x' }, ts: 4 });
  assert.equal(nodeActivityText(tId, run.nodes.n), 'Gagal, mencoba ulang (x)');
  assert.deepEqual(run.log.at(-1).msg, { key: 'logs.code.activity-retry', params: { reason: 'x' } });
});

test('error node dan run membawa code + params untuk diterjemahkan', () => {
  let run = emptyRun('r');
  run = reduceRun(run, { type: 'node', node: 'n', status: 'running', ts: 1 });
  run = reduceRun(run, { type: 'node', node: 'n', status: 'failed', error: 'Agent "x" not found', errorCode: 'AGENT_NOT_FOUND', errorParams: { agent: 'x' }, ts: 2 });
  assert.equal(nodeErrorText(tId, run.nodes.n), 'Agent "x" tidak ditemukan.');
  assert.equal(nodeErrorText(tId, run.nodes.n.history[0]), 'Agent "x" tidak ditemukan.');
  run = reduceRun(run, { type: 'run_end', status: 'failed', error: 'n failed', errorCode: 'NODE_FAILED', errorParams: { node: 'n', reason: 'boom' }, ts: 3 });
  assert.equal(nodeErrorText(tEn, run), 'n failed: boom');
});

async function withFetch(impl, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return impl(url, init); };
  try { await fn(calls); } finally { globalThis.fetch = original; }
}
const json = (body, status = 200) => ({ status, json: async () => body });

test('api update: endpoint, method, dan body sesuai kontrak', async () => {
  await withFetch(() => json({ success: true, data: { ok: 1 } }), async (calls) => {
    await api.updateStatus();
    await api.updateCheck();
    await api.updateCheck('https://example.com/u.json');
    await api.updateApply({ contentVersion: '1.21.0', overwriteLocalEdits: false });
    await api.updateSettings();
    await api.saveUpdateSettings(null);
    assert.deepEqual(calls.map((c) => [c.init.method, c.url]), [
      ['GET', '/api/update/status'], ['POST', '/api/update/check'], ['POST', '/api/update/check'],
      ['POST', '/api/update/apply'], ['GET', '/api/update/settings'], ['PUT', '/api/update/settings'],
    ]);
    assert.deepEqual(JSON.parse(calls[1].init.body), {});
    assert.deepEqual(JSON.parse(calls[2].init.body), { endpoint: 'https://example.com/u.json' });
    assert.deepEqual(JSON.parse(calls[3].init.body), { contentVersion: '1.21.0', overwriteLocalEdits: false });
    assert.deepEqual(JSON.parse(calls[5].init.body), { endpoint: null });
  });
});

test('api update: error server jadi ApiRequestError dengan code dan params; offline = SERVER_UNREACHABLE', async () => {
  const body = { success: false, error: 'Cannot reach the update server', code: 'UPDATE_UNREACHABLE', params: { status: 404 } };
  await withFetch(() => json(body, 503), async () => {
    await assert.rejects(() => api.updateCheck(), (e) => e instanceof ApiRequestError && e.code === 'UPDATE_UNREACHABLE' && e.params.status === 404);
  });
  await withFetch(() => { throw new TypeError('fetch failed'); }, async () => {
    await assert.rejects(() => api.updateStatus(), (e) => e.code === 'SERVER_UNREACHABLE' && errorMessage(tEn, e).includes('studio server'));
  });
});

test('kontrak versi: UI tidak lagi membaca field lama dan pesan REQUIRES_NEW_APP mengarah ke installer baru', () => {
  const root = path.join(STUDIO, 'web/src');
  const src = ['features/update/UpdateDialog.jsx', 'hooks/useUpdate.js'].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /pluginVersion|currentVersion|result\.version|applied\.version|updateApply\(\{ version/);
  assert.match(src, /contentVersion/);
  const err = new ApiRequestError('needs newer app', { code: 'UPDATE_REQUIRES_NEW_APP', params: { minAppVersion: '1.22.0', appVersion: '1.20.0' } });
  const en1 = errorMessage(tEn, err);
  assert.match(en1, /1\.20\.0/);
  assert.match(en1, /1\.22\.0/);
  assert.match(en1, /Update button cannot fix this.*installer/);
  assert.match(errorMessage(tId, err), /Tombol Update tidak bisa memperbaikinya.*installer/);
  assert.ok(en['update.version.app-hint'] && en['update.version.content-hint'] && id['update.version.app-hint'] && id['update.version.content-hint']);
});
