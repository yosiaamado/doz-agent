// startServer: port terpakai → pindah port, runtime.json ikut port baru; kode error masuk envelope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server/app.js';
import { createConfig } from '../server/infra/config.js';
import { badRequest } from '../server/lib/errors.js';

const quiet = { info() {}, warn() {} };
const fakeRunner = { describe: () => 'fake', run: async () => ({ output: '' }), judge: async () => ({ output: '' }) };

function occupy() {
  return new Promise((resolve) => {
    const blocker = net.createServer();
    blocker.listen(0, '127.0.0.1', () => resolve({ blocker, port: blocker.address().port }));
  });
}

// DOZ_RESOURCES_DIR memaksa mode packaged (repoRoot null); semua path diarahkan ke folder sementara.
function build(tmp) {
  fs.mkdirSync(path.join(tmp, 'agents'));
  const env = { DOZ_USER_DATA_DIR: path.join(tmp, 'ud'), DOZ_PLUGIN_DIR: tmp, DOZ_RESOURCES_DIR: path.join(tmp, 'res') };
  const here = path.join(tmp, 'studio', 'server', 'infra'); // studio tiruan: tidak menyentuh .local.json asli
  fs.mkdirSync(here, { recursive: true });
  const config = createConfig({ argv: ['node', 'x', '--workdir', tmp], env, here, logger: quiet });
  return { config, options: { config, runners: { 'claude-cli': fakeRunner, api: fakeRunner }, runnerStatus: () => ({}) } };
}

const tempDir = (name) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), name)));

test('port terpakai → server pindah port, runtime.json dan /api/status memakai port baru', async () => {
  const { blocker, port: busy } = await occupy();
  const { config, options } = build(tempDir('doz-port-'));
  const started = await startServer({ ...options, port: busy });
  try {
    assert.notEqual(started.port, busy);
    assert.equal(started.url, `http://127.0.0.1:${started.port}`);
    const runtime = JSON.parse(fs.readFileSync(path.join(config.userDataDir, 'runtime.json'), 'utf8'));
    assert.equal(runtime.port, started.port);
    assert.equal(runtime.url, started.url);
    assert.equal(runtime.pid, process.pid);
    const { data } = await (await fetch(`${started.url}/api/status`)).json();
    assert.equal(data.port, started.port);
    assert.equal(data.repoRoot, null);
    assert.equal(data.userDataDir, config.userDataDir);
    assert.equal(data.mode, 'packaged');
  } finally {
    await new Promise((r) => started.server.close(r));
    blocker.close();
  }
  assert.ok(!fs.existsSync(path.join(config.userDataDir, 'runtime.json')), 'runtime.json dihapus saat server berhenti');
});

test('kode error + params ikut di envelope; endpoint tak ada → NOT_FOUND; body salah → VALIDATION_FAILED; git repo tanpa induk → REPO_UNAVAILABLE', async () => {
  const tmp = tempDir('doz-err-');
  const { options } = build(tmp);
  const started = await startServer({ ...options, port: 0 });
  try {
    const call = async (method, url, body) => {
      const res = await fetch(`${started.url}${url}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      return { status: res.status, json: await res.json() };
    };
    const missing = await call('POST', '/api/workdir', { path: path.join(tmp, 'tidak-ada') });
    assert.equal(missing.status, 400);
    assert.equal(missing.json.code, 'WORKDIR_NOT_FOUND');
    assert.equal(missing.json.params.path, path.join(tmp, 'tidak-ada'));
    assert.ok(missing.json.error);
    const nf = await call('GET', '/api/tidak-ada');
    assert.equal(nf.status, 404);
    assert.equal(nf.json.code, 'NOT_FOUND');
    const bad = await call('POST', '/api/workdir', {});
    assert.equal(bad.status, 400);
    assert.equal(bad.json.code, 'VALIDATION_FAILED');
    assert.equal(bad.json.error, 'Invalid input');
    const git = await call('GET', '/api/git/repo');
    assert.equal(git.status, 400);
    assert.equal(git.json.code, 'REPO_UNAVAILABLE');
  } finally {
    await new Promise((r) => started.server.close(r));
  }
});

test('ApiError menerima opsi objek dan array details lama', () => {
  assert.deepEqual(badRequest('x', ['a']).details, ['a']);
  const e = badRequest('x', { code: 'C', params: { n: 1 }, details: ['d'] });
  assert.equal(e.code, 'C');
  assert.deepEqual(e.params, { n: 1 });
  assert.deepEqual(e.details, ['d']);
  assert.equal(badRequest('x').code, undefined);
});
