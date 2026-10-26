import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../web/src/i18n/index.js';
import { errorMessage } from '../web/src/lib/errorMessage.js';
import { ApiRequestError, api } from '../web/src/lib/api.js';
import { apiKeyLabel, authLabel, buildProfileBody, configDirLabel, safeHttpUrl } from '../web/src/lib/profiles.js';

const WIN_DIR = `D:${String.fromCharCode(92)}claude-work`;
const tEn = (k, v) => translate('en', k, v);
const tId = (k, v) => translate('id', k, v);

async function withFetch(impl, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return impl(url, init); };
  try { await fn(calls); } finally { globalThis.fetch = original; }
}
const ok = (data) => ({ json: async () => ({ success: true, data }) });

test('profiles api: method, url and body match the contract', async () => {
  await withFetch(() => ok({}), async (calls) => {
    await api.profiles();
    await api.createProfile({ name: 'Work', configDir: '/h/.cw' });
    await api.updateProfile('p_1a2b3c4d', { name: 'W2' });
    await api.deleteProfile('p_1a2b3c4d');
    await api.switchProfile('p_1a2b3c4d');
    await api.setProfileKey('default', 'sk-ant-xxxxxxxxxxxxxxxxxxxx', false);
    await api.clearProfileKey('default');
    await api.profileAuth('p_1a2b3c4d');
    await api.profileLogin('p_1a2b3c4d', true);
    await api.profileLogin('p_1a2b3c4d');
    assert.deepEqual(calls.map((c) => [c.init.method, c.url]), [
      ['GET', '/api/profiles'], ['POST', '/api/profiles'], ['PUT', '/api/profiles/p_1a2b3c4d'], ['DELETE', '/api/profiles/p_1a2b3c4d'],
      ['POST', '/api/profiles/active'], ['PUT', '/api/profiles/default/api-key'], ['DELETE', '/api/profiles/default/api-key'],
      ['GET', '/api/profiles/p_1a2b3c4d/auth'], ['POST', '/api/profiles/p_1a2b3c4d/login'], ['POST', '/api/profiles/p_1a2b3c4d/login'],
    ]);
    assert.deepEqual(JSON.parse(calls[1].init.body), { name: 'Work', configDir: '/h/.cw' });
    assert.deepEqual(JSON.parse(calls[4].init.body), { id: 'p_1a2b3c4d' });
    assert.deepEqual(JSON.parse(calls[5].init.body), { key: 'sk-ant-xxxxxxxxxxxxxxxxxxxx', remember: false });
    assert.deepEqual(JSON.parse(calls[8].init.body), { console: true });
    assert.deepEqual(JSON.parse(calls[9].init.body), { console: false });
  });
});

test('profiles api: the 400 contract example becomes a translated, specific message', async () => {
  const body = { success: false, error: 'configDir must be inside your home folder', code: 'PROFILE_DIR_OUTSIDE_HOME', params: { dir: WIN_DIR } };
  await withFetch(() => ({ json: async () => body }), async () => {
    await assert.rejects(() => api.createProfile({ name: 'x', configDir: WIN_DIR }), (e) => {
      assert.ok(e instanceof ApiRequestError);
      assert.ok(errorMessage(tEn, e).endsWith(`inside your home folder: ${WIN_DIR}`));
      assert.ok(errorMessage(tId, e).includes(WIN_DIR));
      return true;
    });
  });
});

test('profiles errors: every S1 code is translated in en and id (never the raw code)', () => {
  const codes = {
    PROFILE_NAME_TAKEN: { name: 'Work' }, PROFILE_DIR_OUTSIDE_HOME: { dir: '/x' }, PROFILE_DIR_IS_DEFAULT: {}, PROFILE_DIR_TAKEN: {},
    PROFILE_NOT_FOUND: {}, PROFILE_DEFAULT_LOCKED: {}, PROFILE_BUSY: {}, PROFILE_ACTIVE: {}, PROFILE_SWITCH_BUSY: {},
  };
  for (const [code, params] of Object.entries(codes)) {
    const err = new ApiRequestError('server english', { code, params });
    for (const t of [tEn, tId]) {
      const text = errorMessage(t, err);
      assert.notEqual(text, 'server english', `${code} has no translation`);
      assert.ok(!text.includes('{') && !text.includes('error.'), `${code}: ${text}`);
    }
  }
  assert.match(errorMessage(tEn, new ApiRequestError('x', { code: 'PROFILE_NAME_TAKEN', params: { name: 'Work' } })), /"Work"/);
});

test('profiles body: create sends the folder, update only a changed one, default never', () => {
  assert.deepEqual(buildProfileBody(null, { name: ' Work ', configDir: ' ~/.cw ' }), { name: 'Work', configDir: '~/.cw' });
  const work = { id: 'p_1', name: 'Work', configDir: '/h/.cw', isDefault: false };
  assert.deepEqual(buildProfileBody(work, { name: 'Work 2', configDir: '/h/.cw' }), { name: 'Work 2' });
  assert.deepEqual(buildProfileBody(work, { name: 'Work', configDir: '/h/.other' }), { name: 'Work', configDir: '/h/.other' });
  assert.deepEqual(buildProfileBody({ id: 'default', name: 'Default', configDir: null, isDefault: true }, { name: 'Main', configDir: '' }), { name: 'Main' });
});

test('profiles labels: keys appear masked only, every state has copy, null configDir = default folder', () => {
  const masked = 'sk-…WXYZ';
  assert.match(apiKeyLabel(tEn, { state: 'saved', masked }), /sk-…WXYZ/);
  assert.match(apiKeyLabel(tEn, { state: 'environment', masked }), /environment/);
  assert.match(apiKeyLabel(tId, { state: 'unreadable', masked: null }), /dekripsi/);
  assert.equal(apiKeyLabel(tEn, { state: 'none', masked: null }), 'Not set');
  assert.equal(apiKeyLabel(tEn, undefined), 'Not set');
  assert.match(configDirLabel(tEn, { configDir: null }), /~\/\.claude/);
  assert.equal(configDirLabel(tEn, { configDir: '/h/.cw' }), '/h/.cw');
  assert.equal(authLabel(tEn, { loggedIn: false }), 'Not logged in');
  assert.equal(authLabel(tEn, { loggedIn: true, email: 'a@b.c', authMethod: 'claude.ai' }), 'Logged in as a@b.c');
  assert.equal(authLabel(tEn, { loggedIn: true, email: null, authMethod: null, apiProvider: null }), 'Logged in');
});

test('profiles login url: only http(s) becomes a link', () => {
  assert.equal(safeHttpUrl('https://claude.ai/oauth?x=1'), 'https://claude.ai/oauth?x=1');
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('file:///etc/passwd'), null);
  assert.equal(safeHttpUrl(undefined), null);
  assert.equal(safeHttpUrl('not a url'), null);
});
