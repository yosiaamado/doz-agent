// SEC-2: the API key encrypted through the Electron codec (safeStorage), an honest plain-text fallback, file permissions, and no leaking into child processes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConfigStore, tightenPermissions } from '../server/infra/configStore.js';
import { createApiKeyStore } from '../server/infra/apiKeyStore.js';
import { createProfileStore, migrateProfiles } from '../server/infra/profileStore.js';
import { createConfig } from '../server/infra/config.js';
import { runCommand } from '../server/runners/shell.js';
import { createSetupService } from '../server/services/setupService.js';
import { createProfileService } from '../server/services/profileService.js';

const KEY = 'sk-ant-api03-SECRET-1234567890';
const tempDir = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-sec-')));

// A fake codec that is reversible and clearly different from plain text (standing in for safeStorage).
const codec = {
  encrypt: (plain) => Buffer.from(`enc:${[...plain].reverse().join('')}`).toString('base64'),
  decrypt(cipher) {
    const text = Buffer.from(cipher, 'base64').toString('utf8');
    if (!text.startsWith('enc:')) throw new Error('not our ciphertext');
    return [...text.slice(4)].reverse().join('');
  },
};

function spyLogger() {
  const warnings = [];
  return { warnings, info() {}, error() {}, warn: (message) => warnings.push(message) };
}

function setup(withCodec) {
  const file = path.join(tempDir(), 'config.json');
  const logger = spyLogger();
  const store = createConfigStore(file);
  return { file, logger, store, keys: createApiKeyStore({ store, codec: withCodec ? codec : null, logger }) };
}

test('with a codec: the file holds ciphertext only, and the key comes back intact when read', () => {
  const { file, keys } = setup(true);
  keys.set(KEY);
  const raw = fs.readFileSync(file, 'utf8');
  assert.ok(!raw.includes(KEY), 'no plain text may be in the file');
  assert.ok(!raw.includes('"anthropicApiKey"'), 'the plain field is removed');
  assert.ok(JSON.parse(raw).anthropicApiKeyEnc);
  assert.equal(keys.get(), KEY);
});

test('a legacy plain-text key is migrated to the encrypted form on the first read under a codec', () => {
  const { file, store, logger } = setup(false);
  store.merge({ anthropicApiKey: KEY, workdir: 'x' });
  const keys = createApiKeyStore({ store, codec, logger });
  assert.equal(keys.get(), KEY);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.anthropicApiKey, undefined);
  assert.ok(saved.anthropicApiKeyEnc);
  assert.equal(saved.workdir, 'x', 'the other fields survive');
  assert.equal(keys.get(), KEY, 'the second read goes through the encrypted path');
});

test('createConfig with a secretCodec migrates a legacy .local.json holding a plain-text key', () => {
  const root = tempDir();
  const studio = path.join(root, 'studio');
  fs.mkdirSync(path.join(studio, 'server', 'infra'), { recursive: true });
  fs.writeFileSync(path.join(studio, '.local.json'), JSON.stringify({ anthropicApiKey: KEY }));
  const ud = path.join(root, 'ud');
  const config = createConfig({ argv: ['node', 'x', '--workdir', root], env: { DOZ_USER_DATA_DIR: ud }, here: path.join(studio, 'server', 'infra'), logger: spyLogger(), secretCodec: codec });
  assert.equal(config.profiles.getKey('default'), KEY);
  const raw = fs.readFileSync(path.join(ud, 'config.json'), 'utf8');
  assert.ok(!raw.includes(KEY));
});

test('without a codec: a plain-text fallback with the warning logged only once', () => {
  const { file, keys, logger } = setup(false);
  keys.set(KEY);
  keys.set(KEY);
  assert.equal(keys.get(), KEY);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).anthropicApiKey, KEY);
  assert.equal(logger.warnings.length, 1, 'one warning, not one per operation');
  assert.match(logger.warnings[0], /plain text/);
});

test('an encrypted key without a codec, or with corrupt ciphertext → null + a warning, and no throw', () => {
  const { store } = setup(true);
  store.merge({ anthropicApiKeyEnc: codec.encrypt(KEY) });
  const noCodecLogger = spyLogger();
  assert.equal(createApiKeyStore({ store, codec: null, logger: noCodecLogger }).get(), null);
  assert.equal(noCodecLogger.warnings.length, 1);
  store.merge({ anthropicApiKeyEnc: 'not-base64-valid' });
  const badLogger = spyLogger();
  assert.equal(createApiKeyStore({ store, codec, logger: badLogger }).get(), null);
  assert.equal(badLogger.warnings.length, 1);
});

test('set(null) removes both the plain and the encrypted version', () => {
  const { file, keys, store } = setup(true);
  store.merge({ anthropicApiKey: 'old' });
  keys.set(KEY);
  keys.set(null);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.anthropicApiKey, undefined);
  assert.equal(saved.anthropicApiKeyEnc, undefined);
  assert.equal(keys.get(), null);
});

test('POSIX: a legacy config with loose permissions is tightened to 0600 when opened and on every write', { skip: process.platform === 'win32' && 'Windows: mode/chmod do not set ACLs (the protection comes from encryption)' }, () => {
  const file = path.join(tempDir(), 'config.json');
  fs.writeFileSync(file, '{}', { mode: 0o644 });
  fs.chmodSync(file, 0o644);
  const store = createConfigStore(file);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  fs.chmodSync(file, 0o666);
  store.merge({ a: 1 });
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.doesNotThrow(() => tightenPermissions(path.join(tempDir(), 'does-not-exist.json')));
});

test('a key saved in the studio is not passed to an action child process; the user own shell key is', async () => {
  const probe = path.join(tempDir(), 'probe.js');
  fs.writeFileSync(probe, "console.log(process.env.ANTHROPIC_API_KEY || 'none');");
  const command = `node ${probe}`; // no quoting: quoting cmd.exe through spawn breaks it (the temp path has no spaces)
  const serviceWith = (env) => {
    const store = createConfigStore(path.join(tempDir(), 'config.json'));
    migrateProfiles(store);
    return createProfileService({ store: createProfileStore({ store, codec: null, logger: spyLogger() }), env });
  };
  const none = { ...process.env };
  delete none.ANTHROPIC_API_KEY;
  const withSaved = serviceWith(none);
  withSaved.setKey('default', { key: KEY, remember: true });
  const saved = withSaved.spawnContext();
  assert.equal(saved.cliEnv.ANTHROPIC_API_KEY, KEY);
  assert.equal(saved.shellEnv.ANTHROPIC_API_KEY, undefined);
  assert.equal((await runCommand({ command, workdir: '.', env: saved.shellEnv })).output.trim(), 'none');
  const own = serviceWith({ ...none, ANTHROPIC_API_KEY: 'sk-ant-api03-FROM-THE-SHELL' }).spawnContext();
  assert.equal((await runCommand({ command, workdir: '.', env: own.shellEnv })).output.trim(), 'sk-ant-api03-FROM-THE-SHELL');
});

// ---- ciphertext that cannot be opened must be visible to the user (not reported as "no key yet") and must not be deleted
test('state(): none / saved / unreadable are distinguished; ciphertext that fails to decrypt is not deleted', () => {
  const { file, store, keys } = setup(true);
  assert.equal(keys.state(), 'none');
  keys.set(KEY);
  assert.equal(keys.state(), 'saved');
  const before = fs.readFileSync(file, 'utf8');
  const brokenLogger = spyLogger();
  const broken = createApiKeyStore({ store, codec: { encrypt: codec.encrypt, decrypt() { throw new Error('the OS key is not stored yet'); } }, logger: brokenLogger });
  assert.equal(broken.state(), 'unreadable');
  assert.equal(broken.get(), null);
  assert.equal(brokenLogger.warnings.length, 1, 'the warning is logged only once');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'the ciphertext is neither changed nor deleted');
  const noCodec = createApiKeyStore({ store, codec: null, logger: spyLogger() });
  assert.equal(noCodec.state(), 'unreadable', 'encrypted, but running without Electron');
  store.merge({ anthropicApiKeyEnc: undefined, anthropicApiKey: 'plain' });
  assert.equal(createApiKeyStore({ store, codec: null, logger: spyLogger() }).state(), 'saved');
});

test('/api/setup: a stored key that cannot be opened → API_KEY_UNREADABLE; no key at all → API_KEY_MISSING_OPTIONAL', async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const tmp = tempDir();
    const here = path.join(tmp, 'studio', 'server', 'infra');
    fs.mkdirSync(here, { recursive: true });
    const env = { DOZ_USER_DATA_DIR: path.join(tmp, 'ud'), DOZ_PLUGIN_DIR: tmp, DOZ_RESOURCES_DIR: path.join(tmp, 'res') };
    const mk = (secretCodec) => createConfig({ argv: ['node', 'x', '--workdir', tmp], env, here, logger: spyLogger(), secretCodec });
    const check = (config) => createSetupService({ config, apiRunner: { resetClient() {} }, claudeRunner: {}, profiles: createProfileService({ store: config.profiles }) }).check();
    assert.equal((await check(mk(codec))).apiKey.code, 'API_KEY_MISSING_OPTIONAL');
    mk(codec).profiles.setKey('default', KEY);
    const cipher = JSON.parse(fs.readFileSync(path.join(tmp, 'ud', 'config.json'), 'utf8')).profiles[0].apiKeyEnc;
    const unreadable = (await check(mk({ encrypt: codec.encrypt, decrypt() { throw new Error('x'); } }))).apiKey;
    assert.equal(unreadable.code, 'API_KEY_UNREADABLE');
    assert.equal(unreadable.status, 'warn');
    assert.equal(unreadable.action, 'api-key');
    assert.doesNotMatch(unreadable.detail, /No API key yet/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'ud', 'config.json'), 'utf8')).profiles[0].apiKeyEnc, cipher, 'the ciphertext is still there');
    const readable = mk(codec);
  assert.equal(readable.profiles.keyState('default'), 'saved', 'as soon as it can be opened again, the status is back to normal');
    assert.equal(readable.profiles.getKey('default'), KEY);
  } finally {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
});
