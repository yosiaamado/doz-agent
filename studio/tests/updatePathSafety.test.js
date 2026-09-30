// Keamanan path di manifest update: traversal, absolut, drive letter, backslash, null byte, target asing, symlink, host URL.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isSafeRelativePath } from '../server/http/schemas.js';
import { buildManifest, makeEnvironment, startPayloadServer, rejectsWith, sha256 } from './updateFixture.js';

let srv;
before(async () => { srv = await startPayloadServer(); });
after(() => srv.close());

test('isSafeRelativePath menolak semua bentuk path berbahaya', () => {
  const unsafe = [
    '../x', 'a/../../x', 'a/..', '..', '/etc/passwd', '\\windows\\x', 'C:/x', 'c:\\x', 'C:x', 'a\\b', 'a\0b',
    'a/./b', 'a//b', '', 'a/b/', 'a:stream', 'x.', 'a /b', '..\\..\\x',
  ];
  for (const p of unsafe) assert.equal(isSafeRelativePath(p), false, JSON.stringify(p));
  for (const p of ['plugins/agents/a.md', '.hidden/x', 'assets/index-Bk9x.js', 'index.html']) assert.equal(isSafeRelativePath(p), true, p);
  assert.equal(isSafeRelativePath(undefined), false);
  assert.equal(isSafeRelativePath('a'.repeat(501)), false);
});

async function checkWith(env, { files, removed, patchFiles }) {
  const manifest = buildManifest({ base: srv.base, files, removed });
  if (patchFiles) manifest.files = patchFiles(manifest.files);
  srv.publish({ manifest, files, privateKey: env.privateKey });
  return env.service.check({ endpoint: `${srv.base}/doz-update.json` });
}

test('manifest bertanda tangan valid tapi berisi path berbahaya → UPDATE_PATH_REJECTED, tidak ada yang ditulis', async () => {
  const env = makeEnvironment();
  const bad = ['plugins/../../../.claude/settings.json', '/abs/x.md', 'C:/Windows/x.md', 'plugins\\agents\\x.md', 'plugins/agents/a\0.md'];
  for (const p of bad) {
    const files = [{ path: p, target: 'plugins', content: 'pwn' }];
    const e = await rejectsWith(checkWith(env, { files }), 'UPDATE_PATH_REJECTED', 422);
    assert.ok(e.params.path !== undefined, p);
  }
  const e = await rejectsWith(checkWith(env, { files: [{ path: 'plugins/a.md', target: 'plugins', content: 'x' }], removed: [{ path: '../../boom', target: 'plugins' }] }), 'UPDATE_PATH_REJECTED', 422);
  assert.equal(e.params.path, '../../boom');
  assert.deepEqual(fs.readdirSync(env.pluginDir), ['agents']);
});

test('target plugins wajib diawali plugins/; target asing ditolak', async () => {
  const env = makeEnvironment();
  await rejectsWith(checkWith(env, { files: [{ path: 'agents/a.md', target: 'plugins', content: 'x' }] }), 'UPDATE_PATH_REJECTED', 422);
  await rejectsWith(checkWith(env, { files: [{ path: 'plugins/agents/a.md', target: 'system', content: 'x' }] }), 'UPDATE_MANIFEST_INVALID', 422);
  await rejectsWith(checkWith(env, { files: [{ path: 'plugins/agents/a.md', target: '../..', content: 'x' }] }), 'UPDATE_MANIFEST_INVALID', 422);
});

test('url file yang keluar dari host baseUrl atau memakai skema lain ditolak', async () => {
  const env = makeEnvironment();
  const files = [{ path: 'plugins/agents/a.md', target: 'plugins', content: 'x' }];
  for (const url of ['https://evil.example.com/a.md', 'http://127.0.0.1:1/a.md', 'file:///etc/passwd', '//evil.example.com/a.md']) {
    await rejectsWith(checkWith(env, { files, patchFiles: (fs_) => fs_.map((f) => ({ ...f, url })) }), 'UPDATE_MANIFEST_INVALID', 422);
  }
});

test('baseUrl http non-loopback ditolak', async () => {
  const env = makeEnvironment();
  const files = [{ path: 'plugins/agents/a.md', target: 'plugins', content: 'x' }];
  const manifest = { ...buildManifest({ base: srv.base, files }), baseUrl: 'http://example.com/payload/' };
  srv.publish({ manifest, files, privateKey: env.privateKey });
  await rejectsWith(env.service.check({ endpoint: `${srv.base}/doz-update.json` }), 'UPDATE_MANIFEST_INVALID', 422);
});

test('symlink/junction di dalam folder tujuan tidak diikuti: check dan apply menolak, file di luar tidak berubah', async () => {
  const env = makeEnvironment();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-outside-'));
  fs.writeFileSync(path.join(outside, 'victim.md'), 'asli');
  try {
    fs.symlinkSync(outside, path.join(env.pluginDir, 'agents', 'link'), 'junction');
  } catch {
    return; // lingkungan tanpa izin membuat symlink
  }
  const files = [{ path: 'plugins/agents/link/victim.md', target: 'plugins', content: 'ditimpa' }];
  await rejectsWith(checkWith(env, { files }), 'UPDATE_PATH_REJECTED', 422);
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
  assert.equal(fs.readFileSync(path.join(outside, 'victim.md'), 'utf8'), 'asli');
  assert.equal(sha256('asli'), sha256(fs.readFileSync(path.join(outside, 'victim.md'))));
});

// SEC-7: nama device Windows
test('nama device Windows (CON, NUL, COM1, LPT9, AUX, PRN) ditolak, dengan atau tanpa ekstensi, di folder mana pun', async () => {
  for (const p of ['plugins/agents/nul.md', 'plugins/NUL', 'a/con', 'a/CON.txt', 'x/com1', 'x/COM9.log', 'lpt1', 'lpt9.a.b', 'aux.d/file.md', 'prn.md']) {
    assert.equal(isSafeRelativePath(p), false, p);
  }
  for (const p of ['plugins/agents/console.md', 'plugins/agents/nullable.md', 'com10.md', 'plugins/agents/aux-helper.md', 'a/com.md']) {
    assert.equal(isSafeRelativePath(p), true, p);
  }
  const env = makeEnvironment();
  const e = await rejectsWith(checkWith(env, { files: [{ path: 'plugins/agents/nul.md', target: 'plugins', content: 'x' }] }), 'UPDATE_PATH_REJECTED', 422);
  assert.equal(e.params.path, 'plugins/agents/nul.md');
});

// SEC-3: hardlink dan penggantian folder menjadi symlink di tengah unduhan
test('file tujuan yang punya hardlink ke luar folder tidak pernah ditimpa (check tetap jalan, penulisan ditolak)', async () => {
  const env = makeEnvironment();
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-hl-')), 'victim.md');
  fs.writeFileSync(outside, 'asli');
  try {
    fs.linkSync(outside, path.join(env.pluginDir, 'agents', 'a.md'));
  } catch {
    return; // filesystem tanpa hardlink
  }
  const files = [{ path: 'plugins/agents/a.md', target: 'plugins', content: 'ditimpa' }];
  const check = await checkWith(env, { files });
  assert.deepEqual(check.localEdits, [{ path: 'plugins/agents/a.md', target: 'plugins' }]);
  env.service.setSettings({ endpoint: `${srv.base}/doz-update.json` });
  await env.service.check();
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0', overwriteLocalEdits: true }), 'UPDATE_PATH_REJECTED', 422);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'asli');
});

test('folder diganti junction di tengah unduhan → apply ditolak sebelum menulis apa pun di luar folder', async () => {
  const env = makeEnvironment();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-swap-'));
  const sub = path.join(env.pluginDir, 'agents', 'sub');
  fs.mkdirSync(sub);
  const files = [{ path: 'plugins/agents/sub/x.md', target: 'plugins', content: 'pwn' }];
  const manifest = buildManifest({ base: srv.base, files });
  srv.publish({ manifest, files, privateKey: env.privateKey });
  env.service.setSettings({ endpoint: `${srv.base}/doz-update.json` });
  await env.service.check();
  let swapped = false;
  srv.set('/payload/plugins/plugins/agents/sub/x.md', 'pwn', {
    before: () => {
      try {
        fs.rmSync(sub, { recursive: true });
        fs.symlinkSync(outside, sub, 'junction');
        swapped = true;
      } catch { /* tanpa izin symlink */ }
    },
  });
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_PATH_REJECTED', 422).catch((e) => {
    if (swapped) throw e; // hanya boleh lolos kalau penggantian tidak terjadi
  });
  assert.deepEqual(fs.readdirSync(outside), []);
});
