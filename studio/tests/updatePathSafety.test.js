// Path safety in the update manifest: traversal, absolute paths, drive letters, backslashes, null bytes, a foreign target, symlinks, the URL host.
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

test('isSafeRelativePath rejects every dangerous path shape', () => {
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

test('a validly signed manifest that contains a dangerous path → UPDATE_PATH_REJECTED, and nothing is written', async () => {
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

test('the plugins target must be prefixed with plugins/; a foreign target is rejected', async () => {
  const env = makeEnvironment();
  await rejectsWith(checkWith(env, { files: [{ path: 'agents/a.md', target: 'plugins', content: 'x' }] }), 'UPDATE_PATH_REJECTED', 422);
  await rejectsWith(checkWith(env, { files: [{ path: 'plugins/agents/a.md', target: 'system', content: 'x' }] }), 'UPDATE_MANIFEST_INVALID', 422);
  await rejectsWith(checkWith(env, { files: [{ path: 'plugins/agents/a.md', target: '../..', content: 'x' }] }), 'UPDATE_MANIFEST_INVALID', 422);
});

test('a file url that leaves the baseUrl host or uses another scheme is rejected', async () => {
  const env = makeEnvironment();
  const files = [{ path: 'plugins/agents/a.md', target: 'plugins', content: 'x' }];
  for (const url of ['https://evil.example.com/a.md', 'http://127.0.0.1:1/a.md', 'file:///etc/passwd', '//evil.example.com/a.md']) {
    await rejectsWith(checkWith(env, { files, patchFiles: (fs_) => fs_.map((f) => ({ ...f, url })) }), 'UPDATE_MANIFEST_INVALID', 422);
  }
});

test('a non-loopback http baseUrl is rejected', async () => {
  const env = makeEnvironment();
  const files = [{ path: 'plugins/agents/a.md', target: 'plugins', content: 'x' }];
  const manifest = { ...buildManifest({ base: srv.base, files }), baseUrl: 'http://example.com/payload/' };
  srv.publish({ manifest, files, privateKey: env.privateKey });
  await rejectsWith(env.service.check({ endpoint: `${srv.base}/doz-update.json` }), 'UPDATE_MANIFEST_INVALID', 422);
});

test('a symlink/junction inside the destination folder is not followed: check and apply refuse, and the file outside is unchanged', async () => {
  const env = makeEnvironment();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-outside-'));
  fs.writeFileSync(path.join(outside, 'victim.md'), 'original');
  try {
    fs.symlinkSync(outside, path.join(env.pluginDir, 'agents', 'link'), 'junction');
  } catch {
    return; // an environment without permission to create symlinks
  }
  const files = [{ path: 'plugins/agents/link/victim.md', target: 'plugins', content: 'overwritten' }];
  await rejectsWith(checkWith(env, { files }), 'UPDATE_PATH_REJECTED', 422);
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
  assert.equal(fs.readFileSync(path.join(outside, 'victim.md'), 'utf8'), 'original');
  assert.equal(sha256('original'), sha256(fs.readFileSync(path.join(outside, 'victim.md'))));
});

// SEC-7: Windows device names
test('Windows device names (CON, NUL, COM1, LPT9, AUX, PRN) are rejected, with or without an extension, in any folder', async () => {
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

// SEC-3: hardlinks and a folder swapped for a symlink midway through the download
test('a target file with a hardlink to somewhere outside the folder is never overwritten (check still works, the write is refused)', async () => {
  const env = makeEnvironment();
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-hl-')), 'victim.md');
  fs.writeFileSync(outside, 'original');
  try {
    fs.linkSync(outside, path.join(env.pluginDir, 'agents', 'a.md'));
  } catch {
    return; // a filesystem without hardlinks
  }
  const files = [{ path: 'plugins/agents/a.md', target: 'plugins', content: 'overwritten' }];
  const check = await checkWith(env, { files });
  assert.deepEqual(check.localEdits, [{ path: 'plugins/agents/a.md', target: 'plugins' }]);
  env.service.setSettings({ endpoint: `${srv.base}/doz-update.json` });
  await env.service.check();
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0', overwriteLocalEdits: true }), 'UPDATE_PATH_REJECTED', 422);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'original');
});

test('a folder swapped for a junction midway through the download → apply is refused before anything outside the folder is written', async () => {
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
      } catch { /* no symlink permission */ }
    },
  });
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_PATH_REJECTED', 422).catch((e) => {
    if (swapped) throw e; // may only pass when the swap did not happen
  });
  assert.deepEqual(fs.readdirSync(outside), []);
});
