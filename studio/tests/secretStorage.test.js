// SEC-2: API key terenkripsi lewat codec Electron (safeStorage), fallback plain text yang jujur, izin file, dan tidak bocor ke child process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConfigStore, tightenPermissions } from '../server/infra/configStore.js';
import { createApiKeyStore } from '../server/infra/apiKeyStore.js';
import { createConfig } from '../server/infra/config.js';
import { runCommand } from '../server/runners/shell.js';
import { createSetupService } from '../server/services/setupService.js';
import { childEnv, setInjectedApiKey } from '../server/lib/secretEnv.js';

const KEY = 'sk-ant-api03-RAHASIA-1234567890';
const tempDir = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-sec-')));

// Codec palsu yang bisa dibalik dan jelas berbeda dari plain text (menggantikan safeStorage).
const codec = {
  encrypt: (plain) => Buffer.from(`enc:${[...plain].reverse().join('')}`).toString('base64'),
  decrypt(cipher) {
    const text = Buffer.from(cipher, 'base64').toString('utf8');
    if (!text.startsWith('enc:')) throw new Error('bukan ciphertext kita');
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

test('dengan codec: file hanya berisi ciphertext, key kembali utuh saat dibaca', () => {
  const { file, keys } = setup(true);
  keys.set(KEY);
  const raw = fs.readFileSync(file, 'utf8');
  assert.ok(!raw.includes(KEY), 'plain text tidak boleh ada di file');
  assert.ok(!raw.includes('"anthropicApiKey"'), 'field plain dihapus');
  assert.ok(JSON.parse(raw).anthropicApiKeyEnc);
  assert.equal(keys.get(), KEY);
});

test('key plain text lama dimigrasi ke terenkripsi saat pertama dibaca di bawah codec', () => {
  const { file, store, logger } = setup(false);
  store.merge({ anthropicApiKey: KEY, workdir: 'x' });
  const keys = createApiKeyStore({ store, codec, logger });
  assert.equal(keys.get(), KEY);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.anthropicApiKey, undefined);
  assert.ok(saved.anthropicApiKeyEnc);
  assert.equal(saved.workdir, 'x', 'field lain tidak hilang');
  assert.equal(keys.get(), KEY, 'pembacaan kedua lewat jalur terenkripsi');
});

test('createConfig dengan secretCodec memigrasi .local.json lama yang berisi key plain text', () => {
  const root = tempDir();
  const studio = path.join(root, 'studio');
  fs.mkdirSync(path.join(studio, 'server', 'infra'), { recursive: true });
  fs.writeFileSync(path.join(studio, '.local.json'), JSON.stringify({ anthropicApiKey: KEY }));
  const ud = path.join(root, 'ud');
  const config = createConfig({ argv: ['node', 'x', '--workdir', root], env: { DOZ_USER_DATA_DIR: ud }, here: path.join(studio, 'server', 'infra'), logger: spyLogger(), secretCodec: codec });
  assert.equal(config.savedApiKey(), KEY);
  const raw = fs.readFileSync(path.join(ud, 'config.json'), 'utf8');
  assert.ok(!raw.includes(KEY));
});

test('tanpa codec: fallback plain text dengan peringatan hanya sekali di log', () => {
  const { file, keys, logger } = setup(false);
  keys.set(KEY);
  keys.set(KEY);
  assert.equal(keys.get(), KEY);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).anthropicApiKey, KEY);
  assert.equal(logger.warnings.length, 1, 'satu peringatan, bukan per operasi');
  assert.match(logger.warnings[0], /plain text/);
});

test('key terenkripsi tanpa codec atau dengan ciphertext rusak → null + peringatan, tidak melempar', () => {
  const { store } = setup(true);
  store.merge({ anthropicApiKeyEnc: codec.encrypt(KEY) });
  const noCodecLogger = spyLogger();
  assert.equal(createApiKeyStore({ store, codec: null, logger: noCodecLogger }).get(), null);
  assert.equal(noCodecLogger.warnings.length, 1);
  store.merge({ anthropicApiKeyEnc: 'bukan-base64-valid' });
  const badLogger = spyLogger();
  assert.equal(createApiKeyStore({ store, codec, logger: badLogger }).get(), null);
  assert.equal(badLogger.warnings.length, 1);
});

test('set(null) menghapus versi plain dan terenkripsi', () => {
  const { file, keys, store } = setup(true);
  store.merge({ anthropicApiKey: 'lama' });
  keys.set(KEY);
  keys.set(null);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.anthropicApiKey, undefined);
  assert.equal(saved.anthropicApiKeyEnc, undefined);
  assert.equal(keys.get(), null);
});

test('POSIX: config lama bermode longgar diperketat ke 0600 saat dibuka dan setiap ditulis', { skip: process.platform === 'win32' && 'Windows: mode/chmod tidak mengatur ACL (perlindungan datang dari enkripsi)' }, () => {
  const file = path.join(tempDir(), 'config.json');
  fs.writeFileSync(file, '{}', { mode: 0o644 });
  fs.chmodSync(file, 0o644);
  const store = createConfigStore(file);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  fs.chmodSync(file, 0o666);
  store.merge({ a: 1 });
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.doesNotThrow(() => tightenPermissions(path.join(tempDir(), 'tidak-ada.json')));
});

test('key yang disuntikkan studio tidak diteruskan ke child process action; key milik user tetap', async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  const probe = path.join(tempDir(), 'probe.js');
  fs.writeFileSync(probe, "console.log(process.env.ANTHROPIC_API_KEY || 'none');");
  const command = `node ${probe}`; // tanpa tanda kutip: quoting cmd.exe lewat spawn merusaknya (path temp tidak berspasi)
  try {
    process.env.ANTHROPIC_API_KEY = KEY;
    setInjectedApiKey(KEY);
    assert.equal(childEnv().ANTHROPIC_API_KEY, undefined);
    assert.equal(childEnv({ X: '1' }).X, '1');
    const injected = await runCommand({ command, workdir: '.' });
    assert.equal(injected.output.trim(), 'none');
    setInjectedApiKey(null); // key berasal dari environment user
    const own = await runCommand({ command, workdir: '.' });
    assert.equal(own.output.trim(), KEY);
  } finally {
    setInjectedApiKey(null);
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
});

// ---- ciphertext yang tidak bisa dibuka harus terlihat oleh user (bukan "belum ada key") dan tidak dihapus
test('state(): none / saved / unreadable dibedakan; ciphertext yang gagal didekripsi tidak dihapus', () => {
  const { file, store, keys } = setup(true);
  assert.equal(keys.state(), 'none');
  keys.set(KEY);
  assert.equal(keys.state(), 'saved');
  const before = fs.readFileSync(file, 'utf8');
  const brokenLogger = spyLogger();
  const broken = createApiKeyStore({ store, codec: { encrypt: codec.encrypt, decrypt() { throw new Error('kunci OS belum tersimpan'); } }, logger: brokenLogger });
  assert.equal(broken.state(), 'unreadable');
  assert.equal(broken.get(), null);
  assert.equal(brokenLogger.warnings.length, 1, 'peringatan log hanya sekali');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'ciphertext tidak diubah atau dihapus');
  const noCodec = createApiKeyStore({ store, codec: null, logger: spyLogger() });
  assert.equal(noCodec.state(), 'unreadable', 'terenkripsi tetapi mode tanpa Electron');
  store.merge({ anthropicApiKeyEnc: undefined, anthropicApiKey: 'plain' });
  assert.equal(createApiKeyStore({ store, codec: null, logger: spyLogger() }).state(), 'saved');
});

test('/api/setup: key tersimpan yang tidak bisa dibuka → API_KEY_UNREADABLE; tanpa key sama sekali → API_KEY_MISSING_OPTIONAL', async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const tmp = tempDir();
    const here = path.join(tmp, 'studio', 'server', 'infra');
    fs.mkdirSync(here, { recursive: true });
    const env = { DOZ_USER_DATA_DIR: path.join(tmp, 'ud'), DOZ_PLUGIN_DIR: tmp, DOZ_RESOURCES_DIR: path.join(tmp, 'res') };
    const mk = (secretCodec) => createConfig({ argv: ['node', 'x', '--workdir', tmp], env, here, logger: spyLogger(), secretCodec });
    const check = (config) => createSetupService({ config, apiRunner: { resetClient() {} }, claudeRunner: {} }).check();
    assert.equal((await check(mk(codec))).apiKey.code, 'API_KEY_MISSING_OPTIONAL');
    mk(codec).saveApiKey(KEY);
    const cipher = JSON.parse(fs.readFileSync(path.join(tmp, 'ud', 'config.json'), 'utf8')).anthropicApiKeyEnc;
    const unreadable = (await check(mk({ encrypt: codec.encrypt, decrypt() { throw new Error('x'); } }))).apiKey;
    assert.equal(unreadable.code, 'API_KEY_UNREADABLE');
    assert.equal(unreadable.status, 'warn');
    assert.equal(unreadable.action, 'api-key');
    assert.doesNotMatch(unreadable.detail, /No API key yet/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'ud', 'config.json'), 'utf8')).anthropicApiKeyEnc, cipher, 'ciphertext tetap ada');
    const readable = mk(codec);
    assert.equal(readable.apiKeyState(), 'saved', 'begitu bisa dibuka lagi, statusnya kembali normal');
    assert.equal(readable.savedApiKey(), KEY);
  } finally {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
});
