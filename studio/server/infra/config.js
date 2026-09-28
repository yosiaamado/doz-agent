// Konfigurasi studio: workdir aktif dan folder sumber komponen. Disimpan di studio/.local.json.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { badRequest } from '../lib/errors.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const STUDIO_DIR = path.resolve(here, '..', '..');
export const REPO_ROOT = path.resolve(STUDIO_DIR, '..');
export const PLUGIN_DIR = path.join(REPO_ROOT, 'plugins');
export const WEB_DIST = path.join(STUDIO_DIR, 'web', 'dist');
export const SOURCE_KINDS = Object.freeze(['agents', 'skills', 'actions', 'workflows']);

// Path relatif = relatif ke root repo doz-agent. `{workdir}` = folder project aktif, `~` = home.
// Folder pertama jadi tujuan file baru.
export const DEFAULT_SOURCES = Object.freeze({
  agents: ['plugins/agents', '{workdir}/.claude/agents'],
  skills: ['plugins/skills', '{workdir}/.claude/skills'],
  actions: ['plugins/actions'],
  workflows: ['plugins/workflows', '{workdir}/.claude/workflows'],
});

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i > -1 ? argv[i + 1] : undefined;
}

function isDirectory(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

function createLocalFile(file) {
  return {
    read() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return {};
      }
    },
    merge(patch) {
      const next = { ...this.read(), ...patch };
      fs.writeFileSync(file, JSON.stringify(next, null, 2));
      return next;
    },
  };
}

export function createConfig({ argv = process.argv, env = process.env, localFile = path.join(STUDIO_DIR, '.local.json') } = {}) {
  const local = createLocalFile(localFile);
  const saved = local.read();
  let workdir = path.resolve(argValue(argv, '--workdir') ?? env.DOZ_WORKDIR ?? saved.workdir ?? env.INIT_CWD ?? process.cwd());
  let sources = { ...DEFAULT_SOURCES, ...(saved.sources ?? {}) };

  const resolveSource = (entry) => {
    const expanded = String(entry).replace('{workdir}', workdir).replace(/^~(?=$|[/\\])/, os.homedir());
    return path.resolve(REPO_ROOT, expanded);
  };

  return {
    port: Number(argValue(argv, '--port') ?? env.DOZ_STUDIO_PORT ?? 4317),
    repoRoot: REPO_ROOT,
    pluginDir: PLUGIN_DIR,
    webDist: WEB_DIST,
    getWorkdir: () => workdir,
    setWorkdir(dir) {
      const abs = path.resolve(String(dir ?? ''));
      if (!isDirectory(abs)) throw badRequest(`Folder tidak ada: ${abs}`);
      workdir = abs;
      local.merge({ workdir: abs });
      return abs;
    },
    getSources: () => sources,
    setSources(next) {
      sources = Object.fromEntries(SOURCE_KINDS.map((kind) => {
        const list = Array.isArray(next?.[kind]) ? next[kind] : sources[kind];
        return [kind, [...new Set(list.map((s) => String(s).trim()).filter(Boolean))]];
      }));
      local.merge({ sources });
      return sources;
    },
    resolveSource,
    // Folder absolut yang benar-benar ada, urut sesuai konfigurasi.
    sourceDirs: (kind) => (sources[kind] ?? []).map(resolveSource).filter(isDirectory),
    allowedDirs: (kind) => (sources[kind] ?? []).map(resolveSource),
    primaryDir(kind) {
      const first = sources[kind]?.[0];
      if (!first) throw badRequest(`Belum ada folder ${kind}`);
      return resolveSource(first);
    },
    runsDir: () => path.join(workdir, '.doz-studio', 'runs'),
    attachmentsDir: () => path.join(workdir, '.doz-studio', 'attachments'),
    usageFile: path.join(STUDIO_DIR, '.usage.json'),
  };
}
