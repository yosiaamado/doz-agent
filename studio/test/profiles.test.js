import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createConfigStore } from '../server/infra/configStore.js';
import { createProfileStore, migrateProfiles } from '../server/infra/profileStore.js';
import { createProfileService } from '../server/services/profileService.js';
import { createSetupService } from '../server/services/setupService.js';
import { createUsageService } from '../server/services/usageService.js';
import { createRunService } from '../server/services/runService.js';
import { RunRegistry } from '../server/repositories/runLogRepository.js';
import { buildSpawnEnv } from '../server/lib/spawnEnv.js';
import { createClaudeCliRunner } from '../server/runners/claude-cli.js';
import { registerProfileRoutes } from '../server/routes/profileRoutes.js';
import { Router } from '../server/http/router.js';

const tempDir = (name = 'doz-prof-') => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), name)));
const quiet = { info() {}, warn() {}, error() {} };
const KEY = 'sk-ant-api03-abcdefghijklmnopqrstWXYZ';
const codec = {
  encrypt: (p) => Buffer.from(`enc:${p}`).toString('base64'),
  decrypt(c) {
    const t = Buffer.from(c, 'base64').toString('utf8');
    if (!t.startsWith('enc:')) throw new Error('bad');
    return t.slice(4);
  },
};
const brokenCodec = { encrypt: codec.encrypt, decrypt() { throw new Error('no os key'); } };

function fixture({ seed = {}, withCodec = codec, env = {}, isBusy = () => false, spawn } = {}) {
  const home = tempDir('doz-home-');
  const file = path.join(tempDir(), 'config.json');
  const store = createConfigStore(file);
  if (Object.keys(seed).length) store.merge(seed);
  migrateProfiles(store, quiet);
  const profileStore = createProfileStore({ store, codec: withCodec, logger: quiet });
  const messages = [];
  const service = createProfileService({ store: profileStore, broadcast: (m) => messages.push(m), isBusy, env, homedir: home, spawn });
  return { home, file, store, profileStore, service, messages, saved: () => JSON.parse(fs.readFileSync(file, 'utf8')) };
}

const code = (c) => (e) => e.code === c;

test('profiles: migrateProfiles moves an encrypted legacy key into the default profile', () => {
  const f = fixture({ seed: { anthropicApiKeyEnc: 'X', workdir: 'w' } });
  const saved = f.saved();
  assert.deepEqual(saved.profiles, [{ id: 'default', name: 'Default', configDir: null, apiKeyEnc: 'X' }]);
  assert.equal(saved.activeProfileId, 'default');
  assert.equal('anthropicApiKeyEnc' in saved, false);
  assert.equal('anthropicApiKey' in saved, false);
  assert.equal(saved.workdir, 'w');
  const before = fs.readFileSync(f.file, 'utf8');
  migrateProfiles(f.store, quiet);
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
});

test('profiles: migrateProfiles keeps a plain legacy key and an unreadable ciphertext as-is', () => {
  const plain = fixture({ seed: { anthropicApiKey: 'sk-ant-plain-0123456789' }, withCodec: null });
  assert.equal(plain.saved().profiles[0].apiKey, 'sk-ant-plain-0123456789');
  assert.equal(plain.profileStore.getKey('default'), 'sk-ant-plain-0123456789');

  const cipher = Buffer.from('enc:whatever').toString('base64');
  const broken = fixture({ seed: { anthropicApiKeyEnc: cipher }, withCodec: brokenCodec });
  assert.equal(broken.saved().profiles[0].apiKeyEnc, cipher);
  assert.equal(broken.profileStore.keyState('default'), 'unreadable');
  assert.equal(broken.saved().profiles[0].apiKeyEnc, cipher, 'reading does not delete it');
  assert.equal(broken.service.list().profiles[0].apiKey.state, 'unreadable');
});

test('profiles: migration repairs a missing default, a dangling active id and a legacy key left by a downgrade', () => {
  const f = fixture({ seed: { profiles: [{ id: 'p_1a2b3c4d', name: 'Work', configDir: null }], activeProfileId: 'gone', anthropicApiKey: 'sk-ant-old-0123456789' }, withCodec: null });
  const saved = f.saved();
  assert.deepEqual(saved.profiles.map((p) => p.id), ['default', 'p_1a2b3c4d']);
  assert.equal(saved.activeProfileId, 'default');
  assert.equal(saved.profiles[0].apiKey, 'sk-ant-old-0123456789');
  assert.equal('anthropicApiKey' in saved, false);
});

test('profiles: duplicate name rejected case-insensitively', () => {
  const f = fixture();
  f.service.create({ name: 'Work', configDir: path.join(f.home, '.claude-work') });
  assert.throws(() => f.service.create({ name: 'work', configDir: path.join(f.home, '.claude-two') }), code('PROFILE_NAME_TAKEN'));
  assert.throws(() => f.service.create({ name: 'default', configDir: path.join(f.home, '.claude-two') }), (e) => e.status === 400 && e.code === 'PROFILE_NAME_TAKEN');
  assert.equal(fs.existsSync(path.join(f.home, '.claude-two')), false, 'nothing is created for a rejected profile');
});

test('profiles: configDir outside home rejected', (t) => {
  const f = fixture();
  const reject = (dir, expected = 'PROFILE_DIR_OUTSIDE_HOME') => assert.throws(() => f.service.create({ name: `n${Math.random()}`, configDir: dir }), code(expected), dir);
  reject(path.join(f.home, '..', 'x'));
  reject(path.join(f.home, 'a', '..', '..', 'x'));
  reject(f.home);
  reject('relative/dir');
  reject(`${path.join(f.home, 'ok')}\0x`);
  if (process.platform === 'win32') {
    const other = path.parse(f.home).root.toUpperCase().startsWith('Z') ? 'Y:\\x' : 'Z:\\x';
    reject(other);
  }
  const outside = tempDir('doz-outside-');
  const link = path.join(f.home, 'escape');
  let linked = true;
  try { fs.symlinkSync(outside, link, 'junction'); } catch { linked = false; }
  if (linked) {
    reject(link);
    reject(path.join(link, 'sub'));
    assert.equal(fs.existsSync(path.join(outside, 'sub')), false, 'nothing was created through the link');
  } else {
    t.diagnostic('symlink creation not permitted; escape case skipped');
  }
  reject(path.join(f.home, '.claude'), 'PROFILE_DIR_IS_DEFAULT');
  const made = f.service.create({ name: 'Work', configDir: path.join(f.home, '.claude-work') });
  assert.equal(made.configDir, path.join(f.home, '.claude-work'));
  assert.ok(fs.statSync(made.configDir).isDirectory());
  assert.throws(() => f.service.create({ name: 'Other', configDir: path.join(f.home, '.claude-work', '..', '.claude-work') }), code('PROFILE_DIR_TAKEN'));
  assert.ok(f.service.create({ name: 'Tilde', configDir: '~/.claude-tilde' }).configDir.startsWith(f.home));
  assert.throws(() => f.service.update(made.id, { configDir: f.home }), code('PROFILE_DIR_OUTSIDE_HOME'));
});

test('profiles: default cannot be deleted or re-pointed; active cannot be deleted', () => {
  const f = fixture();
  assert.throws(() => f.service.remove('default'), (e) => e.status === 400 && e.code === 'PROFILE_DEFAULT_LOCKED');
  assert.throws(() => f.service.update('default', { configDir: path.join(f.home, '.cw') }), (e) => e.status === 400 && e.code === 'PROFILE_DEFAULT_LOCKED');
  const work = f.service.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  f.service.setActive(work.id);
  assert.throws(() => f.service.remove(work.id), (e) => e.status === 400 && e.code === 'PROFILE_ACTIVE');
  assert.throws(() => f.service.remove('p_00000000'), (e) => e.status === 404 && e.code === 'PROFILE_NOT_FOUND');
  f.service.setActive('default');
  assert.deepEqual(f.service.remove(work.id), { deleted: true });
  assert.deepEqual(f.service.list().profiles.map((p) => p.id), ['default']);
  assert.equal(f.service.update('default', { name: 'Personal' }).name, 'Personal');
});

test('profiles: switching while busy is 409, and changing the active profile folder while busy is 409', () => {
  let busy = false;
  const f = fixture({ isBusy: () => busy });
  const work = f.service.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  busy = true;
  assert.throws(() => f.service.setActive(work.id), (e) => e.status === 409 && e.code === 'PROFILE_SWITCH_BUSY');
  assert.equal(f.service.list().activeProfileId, 'default');
  busy = false;
  f.service.setActive(work.id);
  busy = true;
  assert.throws(() => f.service.update(work.id, { configDir: path.join(f.home, '.cw2') }), (e) => e.status === 409 && e.code === 'PROFILE_BUSY');
  assert.equal(f.service.update(work.id, { name: 'Renamed' }).name, 'Renamed', 'a rename is fine while busy');
  assert.throws(() => f.service.setActive('p_00000000'), code('PROFILE_NOT_FOUND'));
});

test('profiles: no response contains a raw key', () => {
  const f = fixture();
  const work = f.service.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  const view = f.service.setKey(work.id, { key: KEY, remember: true });
  const cipher = f.saved().profiles.find((p) => p.id === work.id).apiKeyEnc;
  assert.ok(cipher);
  const everything = JSON.stringify([f.service.list(), view, f.service.active(), f.messages]);
  assert.ok(!everything.includes(KEY));
  assert.ok(!everything.includes(cipher));
  assert.equal(view.apiKey.masked, 'sk-…WXYZ');
  assert.equal(view.apiKey.state, 'saved');
  assert.equal(f.service.clearKey(work.id).apiKey.state, 'none');
  assert.equal(f.saved().profiles.find((p) => p.id === work.id).apiKeyEnc, undefined);
});

test('profiles: a session-only key is not saved and replaces an older saved key; environment state is default-only', () => {
  const f = fixture({ env: { ANTHROPIC_API_KEY: 'sk-ant-shell-key-0123456789' } });
  const work = f.service.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  const [def, wk] = f.service.list().profiles;
  assert.deepEqual(def.apiKey, { state: 'environment', masked: 'sk-…6789' });
  assert.deepEqual(wk.apiKey, { state: 'none', masked: null });
  f.service.setKey('default', { key: KEY, remember: true });
  f.service.setKey('default', { key: KEY, remember: false });
  assert.equal(f.profileStore.keyState('default'), 'none', 'remember:false clears the saved copy');
  assert.equal(f.service.spawnContext('default').cliEnv.ANTHROPIC_API_KEY, KEY);
  assert.equal(f.service.spawnContext(work.id).cliEnv.ANTHROPIC_API_KEY, undefined, 'the shell key never reaches another profile');
});

test('spawnEnv: non-default profile gets CLAUDE_CONFIG_DIR and only its own key', () => {
  const base = { ANTHROPIC_API_KEY: 'shell', ANTHROPIC_AUTH_TOKEN: 't', PATH: 'p' };
  assert.deepEqual(buildSpawnEnv({ id: 'p_x', configDir: '/h/.cw' }, { apiKey: 'k2', base }), { CLAUDE_CONFIG_DIR: '/h/.cw', ANTHROPIC_API_KEY: 'k2', PATH: 'p' });
  assert.deepEqual(buildSpawnEnv({ id: 'p_x', configDir: '/h/.cw' }, { base }), { CLAUDE_CONFIG_DIR: '/h/.cw', PATH: 'p' });
  assert.equal(base.ANTHROPIC_API_KEY, 'shell', 'the base object is not mutated');
});

test('spawnEnv: default profile inherits the shell env; shell env never gets a saved key', () => {
  const base = { ANTHROPIC_API_KEY: 'shell', PATH: 'p' };
  assert.equal(buildSpawnEnv({ id: 'default', configDir: null }, { apiKey: 'k', base, includeApiKey: false }).ANTHROPIC_API_KEY, 'shell');
  assert.equal('ANTHROPIC_API_KEY' in buildSpawnEnv({ id: 'default', configDir: null }, { apiKey: 'k', base: { PATH: 'p' }, includeApiKey: false }), false);
  assert.equal(buildSpawnEnv({ id: 'default', configDir: null }, { apiKey: 'k', base }).ANTHROPIC_API_KEY, 'k', 'D2: the saved default key wins over the shell key');
  assert.equal('ANTHROPIC_API_KEY' in buildSpawnEnv({ id: 'p_x', configDir: '/h/.cw' }, { apiKey: 'k', base, includeApiKey: false }), false);
});

test('profiles: process.env is never written', async () => {
  const f = fixture();
  const snapshot = () => [process.env.ANTHROPIC_API_KEY, process.env.CLAUDE_CONFIG_DIR, process.env.ANTHROPIC_AUTH_TOKEN];
  const before = snapshot();
  const spawned = [];
  const fakeSpawn = (bin, args, opts) => {
    spawned.push({ bin, args, env: opts.env });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => { child.stdout.emit('data', 'Open https://claude.ai/login?x=1 to sign in\n'); });
    return child;
  };
  const service = createProfileService({ store: f.profileStore, homedir: f.home, spawn: fakeSpawn });
  const work = service.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  service.setKey(work.id, { key: KEY, remember: false });
  service.setKey('default', { key: KEY, remember: true });
  service.setActive(work.id);
  const setup = createSetupService({ config: { getWorkdir: () => f.home }, apiRunner: { resetClient() {} }, claudeRunner: {}, profiles: service });
  setup.setApiKey({ key: KEY, remember: false });
  setup.clearApiKey();
  const login = await service.login(work.id, {});
  assert.equal(login.url, 'https://claude.ai/login?x=1');
  const viaSetup = await setup.startClaudeLogin({ console: true });
  assert.equal(viaSetup.started, true);
  assert.deepEqual(snapshot(), before);
  assert.equal(spawned[0].env.CLAUDE_CONFIG_DIR, path.join(f.home, '.cw'));
  assert.deepEqual(spawned[1].args, ['auth', 'login', '--console']);
  assert.equal(spawned[1].env.CLAUDE_CONFIG_DIR, path.join(f.home, '.cw'), 'the compatibility login targets the active profile');
});

test('profiles: auth status copies only four fields', async () => {
  const json = JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', email: 'a@b.c', accessToken: 'SECRET-TOKEN' });
  const f = fixture({
    spawn: () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {};
      setImmediate(() => { child.stdout.emit('data', json); child.emit('close', 0); });
      return child;
    },
  });
  const info = await f.service.auth('default');
  assert.deepEqual(info, { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', email: 'a@b.c' });
  await assert.rejects(f.service.auth('p_00000000'), code('PROFILE_NOT_FOUND'));
});

test('profiles: routes parse the body and reach the service', async () => {
  const f = fixture();
  const router = new Router();
  registerProfileRoutes(router, { profiles: f.service });
  const call = (method, url, body) => {
    const { handler, params } = router.resolve(method, url);
    return handler({ params, body, query: {} });
  };
  assert.equal(call('GET', '/api/profiles').profiles.length, 1);
  assert.throws(() => call('POST', '/api/profiles', { name: '  ', configDir: 'x' }), (e) => e.name === 'ZodError');
  assert.throws(() => call('PUT', '/api/profiles/default', {}), (e) => e.name === 'ZodError');
  assert.throws(() => call('PUT', '/api/profiles/default/api-key', { key: 'short', remember: true }), (e) => e.name === 'ZodError');
  const work = call('POST', '/api/profiles', { name: 'Work', configDir: path.join(f.home, '.cw') });
  assert.deepEqual(call('POST', '/api/profiles/active', { id: work.id }), { activeProfileId: work.id });
  assert.equal(call('PUT', `/api/profiles/${work.id}/api-key`, { key: KEY, remember: true }).apiKey.masked, 'sk-…WXYZ');
  assert.equal(call('DELETE', `/api/profiles/${work.id}/api-key`).apiKey.state, 'none');
  assert.ok(f.messages.every((m) => m.type === 'profiles'));
  assert.equal(f.messages.at(-1).activeProfileId, work.id);
});

test('claude-cli runner: spawn uses opts.env', async () => {
  const tmp = tempDir();
  const bin = path.join(tmp, 'fake-claude.mjs');
  fs.writeFileSync(bin, `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on('end', () => {
  const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  out({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } });
  out({ type: 'result', subtype: 'success', result: process.env.CLAUDE_CONFIG_DIR + '|' + (process.env.ANTHROPIC_API_KEY ?? 'none'), total_cost_usd: 0, num_turns: 1 });
});
`);
  fs.chmodSync(bin, 0o755);
  // On Windows the CLI is a .cmd shim, so the fake needs one too.
  const cmd = path.join(tmp, 'fake-claude.cmd');
  fs.writeFileSync(cmd, `@node "${bin}" %*
`);
  const limits = [];
  const runner = createClaudeCliRunner({ bin: process.platform === 'win32' ? cmd : bin, pluginDir: '/p', onRateLimit: (info, profileId) => limits.push(profileId) });
  const env = { ...process.env, CLAUDE_CONFIG_DIR: 'X' };
  delete env.ANTHROPIC_API_KEY;
  const res = await runner.run({ node: { type: 'agent' }, agent: null, settings: {}, prompt: 'hi', workdir: tmp, env, profileId: 'p_1', signal: new AbortController().signal });
  assert.equal(res.output, 'X|none');
  const judged = await runner.judge({ prompt: 'hi', settings: {}, workdir: tmp, env, profileId: 'p_2' });
  assert.equal(judged.output, 'X|none');
  assert.deepEqual(limits, ['p_1', 'p_2']);
});

test('usage: projects dir follows the active profile and limits are per profile', async () => {
  const f = fixture();
  const dirA = path.join(f.home, '.claude', 'projects', 'p');
  const work = f.service.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  const dirB = path.join(work.configDir, 'projects', 'p');
  const now = new Date().toISOString();
  const line = (id) => JSON.stringify({ type: 'assistant', timestamp: now, message: { id, model: 'opus', usage: { input_tokens: 10, output_tokens: 1 } } });
  for (const [dir, lines] of [[dirA, [line('a')]], [dirB, [line('b'), line('c')]]]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 's.jsonl'), lines.join('\n'));
  }
  const usageFile = path.join(tempDir(), 'usage.json');
  const usage = createUsageService({ usageFile, profiles: f.service, probe: async () => {} });
  assert.equal((await usage.summary()).local.seven_day.messages, 1);
  usage.recordRateLimit({ unifiedWindows: { five_hour: { utilization: 0.4 } } }, work.id);
  assert.equal((await usage.summary()).limits, null, 'default has no limits of its own');
  f.service.setActive(work.id);
  const summary = await usage.summary();
  assert.equal(summary.local.seven_day.messages, 2);
  assert.equal(summary.profileId, work.id);
  assert.equal(summary.projectsDir, path.join(work.configDir, 'projects'));
  assert.equal(summary.limits.unifiedWindows.five_hour.utilization, 0.4);

  const legacy = path.join(tempDir(), 'usage.json');
  fs.writeFileSync(legacy, JSON.stringify({ updatedAt: 5, info: { legacy: true } }));
  const old = createUsageService({ usageFile: legacy, profiles: { spawnContext: () => ({ profileId: 'default', projectsDir: dirA }) } });
  assert.deepEqual((await old.summary()).limits, { legacy: true });
  old.recordRateLimit({ fresh: true }, 'p_1');
  const rewritten = JSON.parse(fs.readFileSync(legacy, 'utf8'));
  assert.deepEqual(Object.keys(rewritten.byProfile).sort(), ['default', 'p_1']);
  assert.deepEqual(rewritten.byProfile.default.info, { legacy: true }, 'the legacy limits survive the rewrite');
});

test('runService: run snapshots the spawn context', async () => {
  const f = fixture();
  const work = f.service.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  f.service.setActive(work.id);
  const captured = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const runner = { describe: () => 'cmd', async run(opts) { captured.push({ env: opts.env, profileId: opts.profileId }); await gate; return { output: 'ok', cost: 0 }; } };
  const runLog = new RunRegistry({ broadcast() {} });
  const wf = { name: 'w', nodes: [{ id: 'a', type: 'agent', agent: 'x', label: 'A' }], edges: [] };
  const service = createRunService({
    config: { getWorkdir: () => f.home },
    components: { list: () => [{ name: 'x', description: 'd', tools: ['Read'], model: 'sonnet', prompt: 'p' }] },
    workflows: { resolveForRun: () => ({ wf: { ...wf, settings: {}, start: 'a' }, errors: [] }) },
    attachments: { composeInput: (i) => i },
    runLog, runners: { 'claude-cli': runner, api: runner }, tracker: null, profiles: f.service,
  });
  const f2 = createProfileService({ store: f.profileStore, homedir: f.home, isBusy: () => service.hasStudioActive() });
  service.start({ workflow: 'w', input: 'go' });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(service.hasStudioActive(), true);
  assert.throws(() => f2.setActive('default'), (e) => e.status === 409 && e.code === 'PROFILE_SWITCH_BUSY');
  assert.equal(captured[0]?.profileId, work.id);
  assert.equal(captured[0]?.env.CLAUDE_CONFIG_DIR, work.configDir);
  release();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(service.hasStudioActive(), false);
  assert.doesNotThrow(() => f2.setActive('default'));
  const emitted = JSON.stringify([...runLog.runs.values()].map((r) => r.events));
  assert.ok(!emitted.includes('CLAUDE_CONFIG_DIR'), 'the spawn context is never part of an emitted event');
});

test('spawnEnv: non-default profile drops every inherited account variable, even without a configDir', () => {
  const base = {
    ANTHROPIC_API_KEY: 'a', ANTHROPIC_AUTH_TOKEN: 'b', CLAUDE_CODE_OAUTH_TOKEN: 'c', ANTHROPIC_BASE_URL: 'https://x',
    CLAUDE_CODE_USE_BEDROCK: '1', CLAUDE_CODE_USE_VERTEX: '1', CLAUDE_CONFIG_DIR: '/shell', PATH: 'p',
  };
  assert.deepEqual(buildSpawnEnv({ id: 'p_x', configDir: '/h/.cw' }, { base }), { CLAUDE_CONFIG_DIR: '/h/.cw', PATH: 'p' });
  assert.deepEqual(buildSpawnEnv({ id: 'p_y', configDir: null }, { base }), { PATH: 'p' });
  assert.equal(buildSpawnEnv({ id: 'default', configDir: null }, { base }).CLAUDE_CODE_OAUTH_TOKEN, 'c');
});
