// Studio configuration: the active workdir and the component source folders. Stored in the OS app-data folder (config.json).
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { badRequest } from '../lib/errors.js';
import { logger as defaultLogger } from '../lib/logger.js';
import { detectRuntimePaths, resolveWebDist, seedPlugins } from './runtimePaths.js';
import { createConfigStore, migrateLegacyFiles } from './configStore.js';
import { createApiKeyStore } from './apiKeyStore.js';

export const SOURCE_KINDS = Object.freeze(['agents', 'skills', 'actions', 'workflows']);

// `{plugins}` = the active plugin folder, `{workdir}` = the active project folder, `~` = home.
// The first folder becomes the destination for new files.
export const DEFAULT_SOURCES = Object.freeze({
  agents: ['{plugins}/agents', '{workdir}/.claude/agents'],
  skills: ['{plugins}/skills', '{workdir}/.claude/skills'],
  actions: ['{plugins}/actions'],
  workflows: ['{plugins}/workflows', '{workdir}/.claude/workflows'],
});

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i > -1 ? argv[i + 1] : undefined;
}

function isDirectory(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

// Older configs stored 'plugins/agents' (relative to the repo root); it is now relative to the active plugin folder.
const normalizeEntry = (entry) => String(entry).trim().replace(/^plugins(?=[/\\])/, '{plugins}');

function normalizeSources(raw) {
  return Object.fromEntries(Object.entries(raw).map(([kind, list]) => [kind, Array.isArray(list) ? list.map(normalizeEntry) : list]));
}

function readAppVersion(studioDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(studioDir, 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function createConfig({ argv = process.argv, env = process.env, localFile, here, platform, homedir, logger = defaultLogger, secretCodec = null } = {}) {
  const paths = detectRuntimePaths({ env, here, platform, homedir });
  const { studioDir, userDataDir, pluginDir, repoRoot } = paths;
  const appVersion = readAppVersion(studioDir);

  // `localFile` (used by tests) replaces the app-data location entirely, migration included.
  const configFile = localFile ?? path.join(userDataDir, 'config.json');
  const usageFile = localFile ? path.join(path.dirname(localFile), 'usage.json') : path.join(userDataDir, 'usage.json');
  if (!localFile) {
    migrateLegacyFiles({ studioDir, userDataDir, logger });
    if (seedPlugins({ ...paths, version: appVersion })) logger.info('bundled plugins copied to app data', { pluginDir });
  }

  const store = createConfigStore(configFile);
  const saved = store.read();
  const apiKeys = createApiKeyStore({ store, codec: secretCodec, logger });
  if (secretCodec) apiKeys.get(); // a legacy plain-text key is encrypted immediately on first open under Electron
  let workdir = path.resolve(argValue(argv, '--workdir') ?? env.DOZ_WORKDIR ?? saved.workdir ?? env.INIT_CWD ?? process.cwd());
  let sources = normalizeSources({ ...DEFAULT_SOURCES, ...(saved.sources ?? {}) });

  // Other relative entries resolve against the repo root when there is one, otherwise against the plugin folder's parent.
  const relativeBase = repoRoot ?? path.dirname(pluginDir);
  const resolveSource = (entry) => {
    const expanded = String(entry)
      .replaceAll('{plugins}', pluginDir)
      .replaceAll('{workdir}', workdir)
      .replace(/^~(?=$|[/\\])/, os.homedir());
    return path.resolve(relativeBase, expanded);
  };

  return {
    port: Number(argValue(argv, '--port') ?? env.DOZ_STUDIO_PORT ?? 4317),
    mode: paths.mode,
    appVersion,
    studioDir,
    resourcesDir: paths.resourcesDir,
    userDataDir,
    repoRoot,
    pluginDir,
    // Getter: the packaged dist location is checked on use (the resources folder may appear only after the config is created, e.g. in tests).
    get webDist() { return resolveWebDist({ env, studioDir, resourcesDir: paths.resourcesDir }); },
    webOverlay: paths.webOverlay,
    getWorkdir: () => workdir,
    setWorkdir(dir) {
      const abs = path.resolve(String(dir ?? ''));
      if (!isDirectory(abs)) throw badRequest(`Folder does not exist: ${abs}`, { code: 'WORKDIR_NOT_FOUND', params: { path: abs } });
      workdir = abs;
      store.merge({ workdir: abs });
      return abs;
    },
    // The API key from the Setup wizard: encrypted through secretCodec when available, otherwise plain text (see apiKeyStore.js).
    savedApiKey: () => apiKeys.get(),
    saveApiKey: (key) => apiKeys.set(key),
    // 'none' | 'saved' | 'unreadable' (ciphertext exists but cannot be decrypted in this session; never deleted automatically)
    apiKeyState: () => apiKeys.state(),
    setupState: () => store.read().setup ?? {},
    saveSetupState: (state) => store.merge({ setup: { ...(store.read().setup ?? {}), ...state } }),
    // Raw config.json access for other modules (e.g. update.endpoint).
    readSaved: () => store.read(),
    mergeSaved: (patch) => store.merge(patch),
    getSources: () => sources,
    setSources(next) {
      sources = Object.fromEntries(SOURCE_KINDS.map((kind) => {
        const list = Array.isArray(next?.[kind]) ? next[kind] : sources[kind];
        return [kind, [...new Set(list.map(normalizeEntry).filter(Boolean))]];
      }));
      store.merge({ sources });
      return sources;
    },
    resolveSource,
    // The absolute folders that actually exist, in configuration order.
    sourceDirs: (kind) => (sources[kind] ?? []).map(resolveSource).filter(isDirectory),
    allowedDirs: (kind) => (sources[kind] ?? []).map(resolveSource),
    primaryDir(kind) {
      const first = sources[kind]?.[0];
      if (!first) throw badRequest(`No source folder configured for ${kind}`, { code: 'SOURCE_MISSING', params: { kind } });
      return resolveSource(first);
    },
    runsDir: () => path.join(workdir, '.doz-studio', 'runs'),
    attachmentsDir: () => path.join(workdir, '.doz-studio', 'attachments'),
    usageFile,
  };
}
