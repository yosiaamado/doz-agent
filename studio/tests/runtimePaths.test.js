// Resolusi path 3 mode runtime (dev, standalone, packaged) dan override lewat env.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectRuntimePaths, seedPlugins, resolveUserDataDir } from '../server/infra/runtimePaths.js';

const mk = (...parts) => fs.mkdirSync(path.join(...parts), { recursive: true });
const sandbox = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-rt-')));
// `here` meniru studio/server/infra di dalam root tertentu.
const hereOf = (studio) => path.join(studio, 'server', 'infra');

test('mode dev: plugins + .git di induk studio', () => {
  const root = sandbox();
  mk(root, 'plugins', 'agents'); mk(root, '.git'); mk(root, 'studio', 'web', 'dist');
  const p = detectRuntimePaths({ env: { DOZ_USER_DATA_DIR: path.join(root, 'ud') }, here: hereOf(path.join(root, 'studio')) });
  assert.equal(p.mode, 'dev');
  assert.equal(p.pluginDir, path.join(root, 'plugins'));
  assert.equal(p.repoRoot, root);
  assert.equal(p.webDist, path.join(root, 'studio', 'web', 'dist'));
});

test('mode standalone: plugins di induk tanpa .git → repoRoot = induk', () => {
  const root = sandbox();
  mk(root, 'plugins', 'skills'); mk(root, 'studio');
  const p = detectRuntimePaths({ env: { DOZ_USER_DATA_DIR: path.join(root, 'ud') }, here: hereOf(path.join(root, 'studio')) });
  assert.equal(p.mode, 'standalone');
  assert.equal(p.pluginDir, path.join(root, 'plugins'));
  assert.equal(p.repoRoot, root);
});

test('mode standalone: plugins di dalam studio → repoRoot null', () => {
  const root = sandbox();
  mk(root, 'studio', 'plugins', 'agents');
  const p = detectRuntimePaths({ env: { DOZ_USER_DATA_DIR: path.join(root, 'ud') }, here: hereOf(path.join(root, 'studio')) });
  assert.equal(p.mode, 'standalone');
  assert.equal(p.pluginDir, path.join(root, 'studio', 'plugins'));
  assert.equal(p.repoRoot, null);
});

test('standalone tanpa plugins di mana pun: tidak melempar, pluginDir = app-data, repoRoot null', () => {
  const root = sandbox();
  mk(root, 'studio');
  const ud = path.join(root, 'ud');
  const p = detectRuntimePaths({ env: { DOZ_USER_DATA_DIR: ud }, here: hereOf(path.join(root, 'studio')) });
  assert.equal(p.repoRoot, null);
  assert.equal(p.pluginDir, path.join(ud, 'plugins'));
});

test('mode packaged: DOZ_RESOURCES_DIR → pluginDir writable di app-data, webDist read-only, repoRoot null', () => {
  const root = sandbox();
  const res = path.join(root, 'res');
  const ud = path.join(root, 'ud');
  mk(res, 'plugins', 'agents'); mk(res, 'web', 'dist'); mk(root, 'studio');
  const env = { DOZ_RESOURCES_DIR: res, DOZ_USER_DATA_DIR: ud };
  const p = detectRuntimePaths({ env, here: hereOf(path.join(root, 'studio')) });
  assert.equal(p.mode, 'packaged');
  assert.equal(p.pluginDir, path.join(ud, 'plugins'));
  assert.equal(p.webDist, path.join(res, 'web', 'dist'));
  assert.equal(p.repoRoot, null);

  assert.equal(seedPlugins({ ...p, version: '1.20.0' }), true);
  const seedFile = path.join(ud, 'plugins', '.doz-seed.json');
  assert.equal(JSON.parse(fs.readFileSync(seedFile, 'utf8')).contentVersion, '1.20.0');
  assert.ok(fs.existsSync(path.join(ud, 'plugins', 'agents')));
  assert.equal(seedPlugins({ ...p, version: '9.9.9' }), false, 'seeding hanya sekali');
  assert.equal(JSON.parse(fs.readFileSync(seedFile, 'utf8')).contentVersion, '1.20.0');
});

test('aset web hasil update ada di overlay app-data; webDist tetap dist terpaket (overlay per file, bukan pengganti)', () => {
  const root = sandbox();
  const ud = path.join(root, 'ud');
  const res = path.join(root, 'res');
  mk(root, 'studio'); mk(ud, 'web', 'dist'); mk(res, 'web', 'dist');
  fs.writeFileSync(path.join(ud, 'web', 'dist', 'index.html'), '<html/>');
  const p = detectRuntimePaths({ env: { DOZ_USER_DATA_DIR: ud, DOZ_RESOURCES_DIR: res }, here: hereOf(path.join(root, 'studio')) });
  assert.equal(p.webOverlay, path.join(ud, 'web', 'dist'));
  assert.equal(p.webDist, path.join(res, 'web', 'dist'));
});

test('DOZ_PLUGIN_DIR dan DOZ_WEB_DIST menimpa hasil deteksi', () => {
  const root = sandbox();
  mk(root, 'plugins', 'agents'); mk(root, '.git'); mk(root, 'studio'); mk(root, 'custom');
  const env = { DOZ_USER_DATA_DIR: path.join(root, 'ud'), DOZ_PLUGIN_DIR: path.join(root, 'custom'), DOZ_WEB_DIST: path.join(root, 'webx') };
  const p = detectRuntimePaths({ env, here: hereOf(path.join(root, 'studio')) });
  assert.equal(p.pluginDir, path.join(root, 'custom'));
  assert.equal(p.webDist, path.join(root, 'webx'));
});

test('DOZ_PLUGIN_DIR yang tidak ada → error jelas, bukan fallback diam-diam', () => {
  const root = sandbox();
  mk(root, 'plugins', 'agents'); mk(root, '.git'); mk(root, 'studio');
  const env = { DOZ_USER_DATA_DIR: path.join(root, 'ud'), DOZ_PLUGIN_DIR: path.join(root, 'tidak-ada') };
  assert.throws(() => detectRuntimePaths({ env, here: hereOf(path.join(root, 'studio')) }), /DOZ_PLUGIN_DIR.*tidak-ada/);
});

test('folder app-data per OS', () => {
  const home = path.join(path.sep, 'home', 'u');
  assert.equal(resolveUserDataDir({ env: { APPDATA: 'C:\\A' }, platform: 'win32', homedir: home }), path.join('C:\\A', 'doz-studio'));
  assert.equal(resolveUserDataDir({ env: {}, platform: 'win32', homedir: home }), path.join(home, 'AppData', 'Roaming', 'doz-studio'));
  assert.equal(resolveUserDataDir({ env: {}, platform: 'darwin', homedir: home }), path.join(home, 'Library', 'Application Support', 'doz-studio'));
  assert.equal(resolveUserDataDir({ env: { XDG_CONFIG_HOME: '/x' }, platform: 'linux', homedir: home }), path.join('/x', 'doz-studio'));
  assert.equal(resolveUserDataDir({ env: {}, platform: 'linux', homedir: home }), path.join(home, '.config', 'doz-studio'));
});
