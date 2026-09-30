// Konfigurasi studio: workdir aktif dan folder sumber komponen. Disimpan di app-data OS (config.json).
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { badRequest } from '../lib/errors.js';
import { logger as defaultLogger } from '../lib/logger.js';
import { detectRuntimePaths, resolveWebDist, seedPlugins } from './runtimePaths.js';
import { createConfigStore, migrateLegacyFiles } from './configStore.js';
import { createApiKeyStore } from './apiKeyStore.js';

export const SOURCE_KINDS = Object.freeze(['agents', 'skills', 'actions', 'workflows']);

// `{plugins}` = folder plugin aktif, `{workdir}` = folder project aktif, `~` = home.
// Folder pertama jadi tujuan file baru.
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

// Config lama menyimpan 'plugins/agents' (relatif ke root repo); sekarang relatif ke folder plugin aktif.
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

  // `localFile` (dipakai test) menggantikan lokasi app-data sepenuhnya, termasuk migrasi.
  const configFile = localFile ?? path.join(userDataDir, 'config.json');
  const usageFile = localFile ? path.join(path.dirname(localFile), 'usage.json') : path.join(userDataDir, 'usage.json');
  if (!localFile) {
    migrateLegacyFiles({ studioDir, userDataDir, logger });
    if (seedPlugins({ ...paths, version: appVersion })) logger.info('bundled plugins copied to app data', { pluginDir });
  }

  const store = createConfigStore(configFile);
  const saved = store.read();
  const apiKeys = createApiKeyStore({ store, codec: secretCodec, logger });
  if (secretCodec) apiKeys.get(); // key plain text lama langsung dienkripsi saat pertama dibuka di bawah Electron
  let workdir = path.resolve(argValue(argv, '--workdir') ?? env.DOZ_WORKDIR ?? saved.workdir ?? env.INIT_CWD ?? process.cwd());
  let sources = normalizeSources({ ...DEFAULT_SOURCES, ...(saved.sources ?? {}) });

  // Entri relatif lain di-resolve ke root repo kalau ada, kalau tidak ke parent folder plugin.
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
    // Getter: lokasi dist terpaket dicek saat dipakai (folder resources bisa baru muncul setelah config dibuat, mis. di test).
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
    // API key dari wizard Persiapan: terenkripsi lewat secretCodec kalau ada, kalau tidak plain text (lihat apiKeyStore.js).
    savedApiKey: () => apiKeys.get(),
    saveApiKey: (key) => apiKeys.set(key),
    // 'none' | 'saved' | 'unreadable' (ciphertext ada tetapi tidak bisa didekripsi di sesi ini; tidak pernah dihapus otomatis)
    apiKeyState: () => apiKeys.state(),
    setupState: () => store.read().setup ?? {},
    saveSetupState: (state) => store.merge({ setup: { ...(store.read().setup ?? {}), ...state } }),
    // Akses config.json mentah untuk modul lain (mis. update.endpoint).
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
    // Folder absolut yang benar-benar ada, urut sesuai konfigurasi.
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
