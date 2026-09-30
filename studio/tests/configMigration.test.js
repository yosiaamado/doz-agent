// Migrasi config lama (studio/.local.json, .usage.json) ke app-data: sekali jalan, idempoten, tidak menimpa.
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

test('migrasi menyalin .local.json dan .usage.json, meninggalkan file lama + penanda', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ workdir: f.root, anthropicApiKey: 'sk-ant-x' }));
  fs.writeFileSync(path.join(f.studio, '.usage.json'), JSON.stringify({ updatedAt: 1 }));
  const config = createConfig({ argv: ['node', 'x'], env: f.env, here: f.here, logger: quiet });
  assert.equal(config.savedApiKey(), 'sk-ant-x');
  assert.equal(config.getWorkdir(), f.root);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.ud, 'usage.json'), 'utf8')), { updatedAt: 1 });
  assert.ok(fs.existsSync(path.join(f.studio, '.local.json')), 'file lama tidak dihapus');
  assert.ok(fs.existsSync(path.join(f.studio, '.local.json.migrated')));
  assert.equal(config.usageFile, path.join(f.ud, 'usage.json'));
});

test('idempoten dan tidak menimpa config baru yang sudah ada', () => {
  const f = fixture();
  fs.mkdirSync(f.ud, { recursive: true });
  fs.writeFileSync(path.join(f.ud, 'config.json'), JSON.stringify({ anthropicApiKey: 'sk-ant-baru' }));
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ anthropicApiKey: 'sk-ant-lama' }));
  assert.deepEqual(migrateLegacyFiles({ studioDir: f.studio, userDataDir: f.ud, logger: quiet }), []);
  const config = createConfig({ argv: ['node', 'x'], env: f.env, here: f.here, logger: quiet });
  assert.equal(config.savedApiKey(), 'sk-ant-baru');
  assert.ok(!fs.existsSync(path.join(f.studio, '.local.json.migrated')));
  createConfig({ argv: ['node', 'x'], env: f.env, here: f.here, logger: quiet });
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.ud, 'config.json'), 'utf8')).anthropicApiKey, 'sk-ant-baru');
});

test('tanpa file lama: tidak ada yang dibuat sampai ada simpan pertama', () => {
  const f = fixture();
  const config = createConfig({ argv: ['node', 'x', '--workdir', f.root], env: f.env, here: f.here, logger: quiet });
  assert.equal(config.savedApiKey(), null);
  assert.ok(!fs.existsSync(path.join(f.ud, 'config.json')));
  config.saveApiKey('sk-ant-y');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.ud, 'config.json'), 'utf8')).anthropicApiKey, 'sk-ant-y');
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(f.ud, 'config.json')).mode & 0o777, 0o600);
});

test('sources lama "plugins/..." dinormalkan ke {plugins}/ dan tetap ter-resolve', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ sources: { agents: ['plugins/agents', '{workdir}/.claude/agents'] } }));
  const config = createConfig({ argv: ['node', 'x', '--workdir', path.join(f.root, 'work')], env: f.env, here: f.here, logger: quiet });
  assert.deepEqual(config.getSources().agents, ['{plugins}/agents', '{workdir}/.claude/agents']);
  assert.deepEqual(config.sourceDirs('agents'), [path.join(f.root, 'plugins', 'agents')]);
  assert.deepEqual(config.getSources().skills, DEFAULT_SOURCES.skills);
  config.setSources({ agents: ['plugins/agents'] });
  assert.deepEqual(config.getSources().agents, ['{plugins}/agents']);
});

test('tanpa repo induk: entri yang tidak ada di-skip, tidak melempar', () => {
  const f = fixture();
  fs.rmSync(path.join(f.root, 'plugins'), { recursive: true });
  const config = createConfig({ argv: ['node', 'x', '--workdir', path.join(f.root, 'work')], env: f.env, here: f.here, logger: quiet });
  assert.equal(config.repoRoot, null);
  assert.deepEqual(config.sourceDirs('agents'), []);
  assert.equal(config.allowedDirs('agents').length, 2);
});
