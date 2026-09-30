// Migration of the legacy config (studio/.local.json, .usage.json) into app-data: one-time, idempotent, never overwriting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConfig, DEFAULT_SOURCES } from '../server/infra/config.js';
import { migrateLegacyFiles } from '../server/infra/configStore.js';

const quiet = { info() {}, warn() {} };

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-cfg-')));
  const studio = path.join(root, 'studio');
  fs.mkdirSync(path.join(studio, 'server', 'infra'), { recursive: true });
  fs.mkdirSync(path.join(root, 'plugins', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(root, 'work'));
  const ud = path.join(root, 'ud');
  return { root, studio, ud, here: path.join(studio, 'server', 'infra'), env: { DOZ_USER_DATA_DIR: ud } };
}

test('the migration copies .local.json and .usage.json, leaving the old files plus a marker behind', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ workdir: f.root, anthropicApiKey: 'sk-ant-x' }));
  fs.writeFileSync(path.join(f.studio, '.usage.json'), JSON.stringify({ updatedAt: 1 }));
  const config = createConfig({ argv: ['node', 'x'], env: f.env, here: f.here, logger: quiet });
  assert.equal(config.savedApiKey(), 'sk-ant-x');
  assert.equal(config.getWorkdir(), f.root);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.ud, 'usage.json'), 'utf8')), { updatedAt: 1 });
  assert.ok(fs.existsSync(path.join(f.studio, '.local.json')), 'the old file is not deleted');
  assert.ok(fs.existsSync(path.join(f.studio, '.local.json.migrated')));
  assert.equal(config.usageFile, path.join(f.ud, 'usage.json'));
});

test('idempotent, and does not overwrite an existing new config', () => {
  const f = fixture();
  fs.mkdirSync(f.ud, { recursive: true });
  fs.writeFileSync(path.join(f.ud, 'config.json'), JSON.stringify({ anthropicApiKey: 'sk-ant-new' }));
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ anthropicApiKey: 'sk-ant-old' }));
  assert.deepEqual(migrateLegacyFiles({ studioDir: f.studio, userDataDir: f.ud, logger: quiet }), []);
  const config = createConfig({ argv: ['node', 'x'], env: f.env, here: f.here, logger: quiet });
  assert.equal(config.savedApiKey(), 'sk-ant-new');
  assert.ok(!fs.existsSync(path.join(f.studio, '.local.json.migrated')));
  createConfig({ argv: ['node', 'x'], env: f.env, here: f.here, logger: quiet });
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.ud, 'config.json'), 'utf8')).anthropicApiKey, 'sk-ant-new');
});

test('without an old file: nothing is created until the first save', () => {
  const f = fixture();
  const config = createConfig({ argv: ['node', 'x', '--workdir', f.root], env: f.env, here: f.here, logger: quiet });
  assert.equal(config.savedApiKey(), null);
  assert.ok(!fs.existsSync(path.join(f.ud, 'config.json')));
  config.saveApiKey('sk-ant-y');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.ud, 'config.json'), 'utf8')).anthropicApiKey, 'sk-ant-y');
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(f.ud, 'config.json')).mode & 0o777, 0o600);
});

test('legacy sources "plugins/..." are normalized to {plugins}/ and still resolve', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ sources: { agents: ['plugins/agents', '{workdir}/.claude/agents'] } }));
  const config = createConfig({ argv: ['node', 'x', '--workdir', path.join(f.root, 'work')], env: f.env, here: f.here, logger: quiet });
  assert.deepEqual(config.getSources().agents, ['{plugins}/agents', '{workdir}/.claude/agents']);
  assert.deepEqual(config.sourceDirs('agents'), [path.join(f.root, 'plugins', 'agents')]);
  assert.deepEqual(config.getSources().skills, DEFAULT_SOURCES.skills);
  config.setSources({ agents: ['plugins/agents'] });
  assert.deepEqual(config.getSources().agents, ['{plugins}/agents']);
});

test('without a parent repo: entries that do not exist are skipped, with no throw', () => {
  const f = fixture();
  fs.rmSync(path.join(f.root, 'plugins'), { recursive: true });
  const config = createConfig({ argv: ['node', 'x', '--workdir', path.join(f.root, 'work')], env: f.env, here: f.here, logger: quiet });
  assert.equal(config.repoRoot, null);
  assert.deepEqual(config.sourceDirs('agents'), []);
  assert.equal(config.allowedDirs('agents').length, 2);
});
