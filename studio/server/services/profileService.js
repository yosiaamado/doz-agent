// Claude account profiles: validation, the active profile, per-spawn environments and the API key of each profile.
// A key never leaves this service except inside a SpawnContext, and a SpawnContext is never serialized or emitted.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { badRequest, notFound, conflict } from '../lib/errors.js';
import { buildSpawnEnv } from '../lib/spawnEnv.js';
import { isSafeRelativePath } from '../http/schemas.js';
import { DEFAULT_PROFILE_ID } from '../infra/profileStore.js';

const IS_WINDOWS = process.platform === 'win32';
const LOGIN_URL_WAIT_MS = 8000;
const AUTH_TIMEOUT_MS = 20_000;

export const maskKey = (key) => (String(key).length >= 12 ? `sk-…${String(key).slice(-4)}` : 'sk-…');

const isInside = (parent, child) => {
  const rel = path.relative(parent, child);
  return Boolean(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};
const samePath = (a, b) => path.relative(a, b) === '';

export function createProfileService({ store, broadcast = () => {}, isBusy = () => false, isInUse = () => false, spawn = nodeSpawn, env = process.env, homedir = os.homedir() }) {
  const home = path.resolve(homedir);
  const defaultDir = path.join(home, '.claude');
  // Keys entered with "remember: false" live here for this process only.
  const sessionKeys = new Map();

  const outside = (dir) => badRequest('configDir must be inside your home folder', { code: 'PROFILE_DIR_OUTSIDE_HOME', params: { dir: String(dir).slice(0, 300) } });
  const requireProfile = (id) => store.get(id) ?? (() => { throw notFound('Profile not found', { code: 'PROFILE_NOT_FOUND', params: { id: String(id).slice(0, 40) } }); })();
  const notify = () => broadcast({ type: 'profiles', activeProfileId: store.activeId() });

  // The nearest existing ancestor is resolved through symlinks, so a link inside home that points outside is caught
  // before anything is created. A dangling link counts as an escape because mkdir would follow it later.
  function assertRealInsideHome(dir, input) {
    let realHome;
    try { realHome = fs.realpathSync(home); } catch { throw outside(input); }
    let probe = dir;
    const tail = [];
    for (;;) {
      try {
        fs.lstatSync(probe);
        break;
      } catch (err) {
        if (err.code !== 'ENOENT') throw outside(input);
      }
      const parent = path.dirname(probe);
      if (parent === probe) throw outside(input);
      tail.unshift(path.basename(probe));
      probe = parent;
    }
    let real;
    try { real = fs.realpathSync(probe); } catch { throw outside(input); }
    const target = path.join(real, ...tail);
    if (!isInside(realHome, target)) throw outside(input);
  }

  function resolveConfigDir(input, exceptId = null) {
    const raw = String(input);
    const expanded = /^~(?=$|[\\/])/.test(raw) ? path.join(home, raw.slice(1)) : raw;
    if (raw.includes('\0') || !path.isAbsolute(expanded)) throw outside(raw);
    const dir = path.resolve(expanded);
    if (!isInside(home, dir) || !isSafeRelativePath(path.relative(home, dir).split(path.sep).join('/'))) throw outside(raw);
    assertRealInsideHome(dir, raw);
    if (samePath(defaultDir, dir)) throw badRequest('That is the default Claude folder (~/.claude); use the Default profile', { code: 'PROFILE_DIR_IS_DEFAULT', params: { dir } });
    const clash = store.list().find((p) => p.id !== exceptId && p.configDir && samePath(p.configDir, dir));
    if (clash) throw badRequest('Another profile already uses this folder', { code: 'PROFILE_DIR_TAKEN', params: { dir, name: clash.name } });
    return dir;
  }

  function ensureDir(dir, input) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Re-checked after creation: the folder must not have been swapped for a link in between.
      assertRealInsideHome(dir, input);
    } catch (err) {
      if (err.status) throw err;
      throw outside(input);
    }
  }

  function assertNameFree(name, exceptId = null) {
    const wanted = name.toLowerCase();
    if (store.list().some((p) => p.id !== exceptId && p.name.toLowerCase() === wanted)) {
      throw badRequest('A profile with this name already exists', { code: 'PROFILE_NAME_TAKEN', params: { name } });
    }
  }

  const effectiveKey = (id) => sessionKeys.get(id) ?? store.getKey(id);

  function projectsDirOf(profile) {
    return path.join(profile.configDir ?? env.CLAUDE_CONFIG_DIR ?? defaultDir, 'projects');
  }

  function keyView(profile) {
    const session = sessionKeys.get(profile.id);
    if (session) return { state: 'saved', masked: maskKey(session) };
    const state = store.keyState(profile.id);
    if (state === 'unreadable') return { state, masked: null };
    if (state === 'saved') return { state, masked: maskKey(store.getKey(profile.id)) };
    if (profile.id === DEFAULT_PROFILE_ID && env.ANTHROPIC_API_KEY) return { state: 'environment', masked: maskKey(env.ANTHROPIC_API_KEY) };
    return { state: 'none', masked: null };
  }

  const view = (profile, activeId = store.activeId()) => ({
    id: profile.id,
    name: profile.name,
    configDir: profile.configDir,
    isDefault: profile.id === DEFAULT_PROFILE_ID,
    active: profile.id === activeId,
    apiKey: keyView(profile),
    projectsDir: projectsDirOf(profile),
  });

  function spawnContext(profileId = store.activeId()) {
    const profile = requireProfile(profileId);
    const apiKey = effectiveKey(profile.id);
    return {
      profileId: profile.id,
      configDir: profile.configDir,
      cliEnv: buildSpawnEnv(profile, { apiKey, base: env }),
      shellEnv: buildSpawnEnv(profile, { apiKey, base: env, includeApiKey: false }),
      projectsDir: projectsDirOf(profile),
    };
  }

  function runClaude(args, ctx, { timeoutMs, onChunk, onSettled }) {
    const child = spawn('claude', args, { shell: IS_WINDOWS, stdio: ['ignore', 'pipe', 'pipe'], env: { ...ctx.cliEnv, GIT_TERMINAL_PROMPT: '0' } });
    child.stdout?.on('data', (c) => onChunk(String(c)));
    child.stderr?.on('data', (c) => onChunk(String(c)));
    child.on('error', (err) => onSettled({ error: err }));
    child.on('close', (code) => onSettled({ code }));
    const timer = setTimeout(() => onSettled({ timeout: true }), timeoutMs);
    timer.unref?.();
    return { child, timer };
  }

  return {
    maskKey,
    spawnContext,

    list() {
      const activeId = store.activeId();
      const profiles = store.list().map((p) => view(p, activeId));
      profiles.sort((a, b) => (a.isDefault === b.isDefault ? a.name.localeCompare(b.name) : a.isDefault ? -1 : 1));
      return { activeProfileId: activeId, profiles };
    },

    active: () => view(requireProfile(store.activeId())),

    create({ name, configDir }) {
      const trimmed = name.trim();
      assertNameFree(trimmed);
      const dir = resolveConfigDir(configDir);
      ensureDir(dir, configDir);
      const created = store.create({ name: trimmed, configDir: dir });
      notify();
      return view(created);
    },

    update(id, { name, configDir }) {
      const profile = requireProfile(id);
      const patch = {};
      if (configDir !== undefined) {
        if (profile.id === DEFAULT_PROFILE_ID) throw badRequest('The default profile always uses ~/.claude', { code: 'PROFILE_DEFAULT_LOCKED' });
        patch.configDir = resolveConfigDir(configDir, id);
      }
      if (name !== undefined) {
        assertNameFree(name.trim(), id);
        patch.name = name.trim();
      }
      if (patch.configDir && patch.configDir !== profile.configDir) {
        if (isInUse(id)) throw conflict('Chats still use this profile: delete them before changing its folder', { code: 'PROFILE_IN_USE' });
        if (profile.id === store.activeId() && isBusy()) throw conflict('Stop the running work before changing the active profile folder', { code: 'PROFILE_BUSY' });
        ensureDir(patch.configDir, configDir);
      }
      const updated = store.update(id, patch);
      notify();
      return view(updated);
    },

    remove(id) {
      const profile = requireProfile(id);
      if (profile.id === DEFAULT_PROFILE_ID) throw badRequest('The default profile cannot be deleted', { code: 'PROFILE_DEFAULT_LOCKED' });
      if (profile.id === store.activeId()) throw badRequest('Switch to another profile before deleting this one', { code: 'PROFILE_ACTIVE' });
      store.remove(id);
      sessionKeys.delete(id);
      notify();
      return { deleted: true };
    },

    setActive(id) {
      requireProfile(id);
      if (id === store.activeId()) return { activeProfileId: id };
      if (isBusy()) throw conflict('Wait for the running work to finish before switching profiles', { code: 'PROFILE_SWITCH_BUSY' });
      store.setActive(id);
      notify();
      return { activeProfileId: id };
    },

    setKey(id, { key, remember }) {
      const profile = requireProfile(id);
      // Always cleared first: "remember: false" must not leave an older saved key behind.
      store.setKey(id, remember ? key : null);
      if (remember) sessionKeys.delete(id);
      else sessionKeys.set(id, key);
      notify();
      return view(profile);
    },

    clearKey(id) {
      const profile = requireProfile(id);
      store.setKey(id, null);
      sessionKeys.delete(id);
      notify();
      return view(profile);
    },

    // Reads `claude auth status` for this profile; only four fields are copied, never a token.
    async auth(id) {
      const ctx = spawnContext(id);
      return new Promise((resolve) => {
        let out = '';
        let settled = false;
        let handle;
        const finish = (info) => {
          if (settled) return;
          settled = true;
          clearTimeout(handle?.timer);
          if (info.timeout || info.error) handle?.child?.kill();
          resolve(authInfo(out));
        };
        try {
          handle = runClaude(['auth', 'status'], ctx, { timeoutMs: AUTH_TIMEOUT_MS, onChunk: (c) => { out += c; }, onSettled: finish });
        } catch {
          finish({ error: true });
        }
      });
    },

    // `claude auth login` opens a browser on this computer. The login URL is returned in case the browser does not open on its own.
    async login(id, { console: useConsole } = {}) {
      const ctx = spawnContext(id);
      return new Promise((resolve) => {
        let output = '';
        let settled = false;
        let waitTimer;
        let child;
        const done = (extra = {}) => {
          if (settled) return;
          settled = true;
          clearTimeout(waitTimer);
          resolve({ started: true, url: /https:\/\/\S+/.exec(output)?.[0] ?? null, output: output.trim().slice(-600), ...extra });
        };
        try {
          child = spawn('claude', ['auth', 'login', ...(useConsole ? ['--console'] : [])], { shell: IS_WINDOWS, stdio: ['ignore', 'pipe', 'pipe'], env: { ...ctx.cliEnv, GIT_TERMINAL_PROMPT: '0' } });
        } catch (err) {
          return done({ started: false, url: null, output: err.message });
        }
        const collect = (c) => {
          output += c;
          if (/https:\/\/\S+/.test(output)) done();
        };
        child.stdout?.on('data', collect);
        child.stderr?.on('data', collect);
        child.on('error', (err) => done({ started: false, url: null, output: err.message }));
        child.on('close', () => done());
        waitTimer = setTimeout(done, LOGIN_URL_WAIT_MS);
        // A login nobody finishes must not keep the process alive; the kill timer is deliberately not cleared by done().
        setTimeout(() => child.kill(), 5 * 60_000).unref?.();
      });
    },
  };
}

function authInfo(out) {
  const none = { loggedIn: false, authMethod: null, apiProvider: null, email: null };
  try {
    const s = JSON.parse(out.trim());
    const str = (v) => (typeof v === 'string' ? v.slice(0, 200) : null);
    return { loggedIn: s.loggedIn === true, authMethod: str(s.authMethod), apiProvider: str(s.apiProvider), email: str(s.email) };
  } catch {
    return none;
  }
}
