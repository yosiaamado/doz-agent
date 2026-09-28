import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSetupService, friendlyError } from '../server/services/setupService.js';
import { createConfig } from '../server/infra/config.js';
import { ApiError } from '../server/lib/errors.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-setup-'));
const config = createConfig({ argv: ['node', 'x', '--workdir', tmp], env: {}, localFile: path.join(tmp, 'local.json') });

test('pesan error tes dibuat bisa ditindaklanjuti', () => {
  assert.match(friendlyError({ status: 401 }).message, /API key ditolak/);
  assert.match(friendlyError({ status: 429 }).message, /rate limit/);
  assert.match(friendlyError(new Error('fetch failed')).message, /koneksi/);
  const own = new ApiError(400, 'x');
  assert.equal(friendlyError(own), own);
});

test('API key: dipasang untuk sesi, disimpan hanya kalau diminta, lalu bisa dihapus', () => {
  const before = process.env.ANTHROPIC_API_KEY;
  let resets = 0;
  const setup = createSetupService({ config, apiRunner: { resetClient: () => { resets++; } }, claudeRunner: {} });
  const session = setup.setApiKey({ key: 'sk-ant-api03-abcdefghijklmnop', remember: false });
  assert.equal(process.env.ANTHROPIC_API_KEY, 'sk-ant-api03-abcdefghijklmnop');
  assert.equal(session.masked, 'sk-ant-…mnop');
  assert.equal(config.savedApiKey(), null);
  setup.setApiKey({ key: 'sk-ant-api03-abcdefghijklmnop', remember: true });
  assert.equal(config.savedApiKey(), 'sk-ant-api03-abcdefghijklmnop');
  setup.clearApiKey();
  assert.equal(config.savedApiKey(), null);
  assert.equal(process.env.ANTHROPIC_API_KEY, undefined);
  assert.equal(resets, 3);
  if (before) process.env.ANTHROPIC_API_KEY = before;
});

test('tes memakai runner yang di-inject dan hasilnya dicatat', async () => {
  const setup = createSetupService({
    config,
    apiRunner: { resetClient() {}, testApiConnection: async () => { throw Object.assign(new Error('401'), { status: 401 }); } },
    claudeRunner: { judge: async () => ({ output: 'ok', cost: 0.001 }) },
  });
  const res = await setup.test('claude-cli');
  assert.equal(res.status, 'ok');
  process.env.ANTHROPIC_API_KEY = 'sk-ant-x';
  await assert.rejects(setup.test('api'), /API key ditolak/);
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(config.setupState()['claude-cli'].ok, true);
  assert.equal(config.setupState().api.ok, false);
  assert.ok(setup.complete().completedAt);
  await assert.rejects(setup.test('lain'), /tes tidak dikenal/);
});

test('pemeriksaan lengkap mengembalikan semua item', async () => {
  const setup = createSetupService({ config, apiRunner: {}, claudeRunner: {} });
  const res = await setup.check();
  for (const key of ['node', 'claude', 'claudeAuth', 'plugin', 'apiKey', 'git', 'repo', 'project']) {
    assert.ok(['ok', 'warn', 'error'].includes(res[key].status), key);
  }
  assert.equal(res.project.status, 'warn'); // tmp bukan repo git
});
