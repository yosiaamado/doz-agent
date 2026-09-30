// Runtime path resolution: dev / standalone (zip) / packaged (Electron) modes, the OS app-data folder, and plugin seeding.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const MODES = Object.freeze({ dev: 'dev', standalone: 'standalone', packaged: 'packaged' });
export const APP_DIR_NAME = 'doz-studio';

const defaultHere = path.dirname(fileURLToPath(import.meta.url));

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

// A plugin folder counts as valid when it contains agents/ or skills/.
export function hasPlugins(dir) {
  return isDirectory(path.join(dir, 'agents')) || isDirectory(path.join(dir, 'skills'));
}

export function resolveUserDataDir({ env = process.env, platform = process.platform, homedir = os.homedir() } = {}) {
  if (env.DOZ_USER_DATA_DIR) return path.resolve(env.DOZ_USER_DATA_DIR);
  if (platform === 'win32') return path.join(env.APPDATA ?? path.join(homedir, 'AppData', 'Roaming'), APP_DIR_NAME);
  if (platform === 'darwin') return path.join(homedir, 'Library', 'Application Support', APP_DIR_NAME);
  return path.join(env.XDG_CONFIG_HOME ?? path.join(homedir, '.config'), APP_DIR_NAME);
}

function detectMode({ env, studioDir }) {
  if (env.DOZ_RESOURCES_DIR) return MODES.packaged;
  const parent = path.resolve(studioDir, '..');
  return isDirectory(path.join(parent, 'plugins')) && fs.existsSync(path.join(parent, '.git')) ? MODES.dev : MODES.standalone;
}

function resolvePluginDir({ env, mode, studioDir, resourcesDir, userDataDir }) {
  if (env.DOZ_PLUGIN_DIR) {
    const dir = path.resolve(env.DOZ_PLUGIN_DIR);
    // An explicit override that is wrong must fail loudly, not quietly fall back to another folder.
    if (!isDirectory(dir)) throw new Error(`DOZ_PLUGIN_DIR points at a folder that does not exist: ${dir}`);
    return dir;
  }
  const userPlugins = path.join(userDataDir, 'plugins');
  // Packaged: the write destination is always app-data; the read-only resources are used only as a seed.
  if (mode === MODES.packaged) return userPlugins;
  const candidates = [userPlugins, path.resolve(studioDir, '..', 'plugins'), path.join(studioDir, 'plugins')];
  if (resourcesDir) candidates.push(path.join(resourcesDir, 'plugins'));
  return candidates.find(hasPlugins) ?? userPlugins;
}

// Packaged web assets (read-only). Assets installed by an update (S5) live in a separate overlay, see resolveWebOverlay.
export function resolveWebDist({ env, studioDir, resourcesDir }) {
  if (env.DOZ_WEB_DIST) return path.resolve(env.DOZ_WEB_DIST);
  if (resourcesDir && isDirectory(path.join(resourcesDir, 'web', 'dist'))) return path.join(resourcesDir, 'web', 'dist');
  return path.join(studioDir, 'web', 'dist');
}

// A per-file overlay: the static handler looks here first, then falls back to webDist. Even a partial web update is safe
// because unchanged assets keep being served from the packaged dist.
export const resolveWebOverlay = (userDataDir) => path.join(userDataDir, 'web', 'dist');

function resolveRepoRoot({ mode, studioDir }) {
  if (mode === MODES.packaged) return null;
  const parent = path.resolve(studioDir, '..');
  if (mode === MODES.dev) return parent;
  return isDirectory(path.join(parent, 'plugins')) ? parent : null;
}

export function detectRuntimePaths({ env = process.env, here = defaultHere, platform, homedir } = {}) {
  const studioDir = path.resolve(here, '..', '..');
  const resourcesDir = env.DOZ_RESOURCES_DIR ? path.resolve(env.DOZ_RESOURCES_DIR) : null;
  const userDataDir = resolveUserDataDir({ env, platform, homedir });
  const mode = detectMode({ env, studioDir });
  const ctx = { env, mode, studioDir, resourcesDir, userDataDir };
  return {
    mode,
    studioDir,
    resourcesDir,
    userDataDir,
    pluginDir: resolvePluginDir(ctx),
    webDist: resolveWebDist(ctx),
    webOverlay: resolveWebOverlay(userDataDir),
    repoRoot: resolveRepoRoot(ctx),
  };
}

// Copies the bundled plugins into app-data once, so the plugin folder is writable (component edits plus updates).
export function seedPlugins({ pluginDir, resourcesDir, userDataDir, version }) {
  const seedSource = resourcesDir ? path.join(resourcesDir, 'plugins') : null;
  if (!seedSource || pluginDir !== path.join(userDataDir, 'plugins')) return false;
  if (fs.existsSync(pluginDir) || !isDirectory(seedSource)) return false;
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.cpSync(seedSource, pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, '.doz-seed.json'), JSON.stringify({ contentVersion: version, seededAt: Date.now() }));
  return true;
}
