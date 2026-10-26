import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSetupService, friendlyError } from '../server/services/setupService.js';
import { createConfig } from '../server/infra/config.js';
import { createProfileService } from '../server/services/profileService.js';
import { ApiError } from '../server/lib/errors.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-setup-'));
const config = createConfig({ argv: ['node', 'x', '--workdir', tmp], env: {}, localFile: path.join(tmp, 'local.json') });
const profilesFor = (env = {}) => createProfileService({ store: config.profiles, env });

test('the error messages from a test are actionable', () => {
  assert.equal(friendlyError({ status: 401 }).code, 'API_KEY_REJECTED');
  assert.equal(friendlyError({ status: 429 }).code, 'API_RATE_LIMITED');
  assert.equal(friendlyError(new Error('fetch failed')).code, 'API_UNREACHABLE');
  const own = new ApiError(400, 'x');
  assert.equal(friendlyError(own), own);
});

test('API key: applied for the session, stored only when asked, then removable', () => {
  let resets = 0;
  const setup = createSetupService({ config, apiRunner: { resetClient: () => { resets++; } }, claudeRunner: {}, profiles: profilesFor() });
  const session = setup.setApiKey({ key: 'sk-ant-api03-abcdefghijklmnop', remember: false });
  assert.equal(session.masked, 'sk-…mnop');
  assert.equal(config.profiles.getKey('default'), null);
  setup.setApiKey({ key: 'sk-ant-api03-abcdefghijklmnop', remember: true });
  assert.equal(config.profiles.getKey('default'), 'sk-ant-api03-abcdefghijklmnop');
  setup.clearApiKey();
  assert.equal(config.profiles.getKey('default'), null);
  assert.equal(resets, 3);
});

test('the tests use the injected runner and their results are recorded', async () => {
  const setup = createSetupService({
    config,
    apiRunner: { resetClient() {}, testApiConnection: async () => { throw Object.assign(new Error('401'), { status: 401 }); } },
    claudeRunner: { judge: async () => ({ output: 'ok', cost: 0.001 }) },
    profiles: profilesFor({ ANTHROPIC_API_KEY: 'sk-ant-x' }),
  });
  const res = await setup.test('claude-cli');
  assert.equal(res.status, 'ok');
  await assert.rejects(setup.test('api'), /API key rejected/);
  assert.equal(config.setupState()['claude-cli'].ok, true);
  assert.equal(config.setupState().api.ok, false);
  assert.ok(setup.complete().completedAt);
  await assert.rejects(setup.test('other'), /Unknown test/);
});

test('a full check returns every item', async () => {
  const setup = createSetupService({ config, apiRunner: {}, claudeRunner: {}, profiles: profilesFor() });
  const res = await setup.check();
  for (const key of ['node', 'claude', 'claudeAuth', 'plugin', 'apiKey', 'git', 'repo', 'project']) {
    assert.ok(['ok', 'warn', 'error'].includes(res[key].status), key);
  }
  assert.equal(res.project.status, 'warn'); // tmp is not a git repo
});
