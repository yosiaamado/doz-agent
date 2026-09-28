import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const STUDIO_DIR = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(STUDIO_DIR, '..');
export const PLUGIN_DIR = path.join(REPO_ROOT, 'plugins');
const LOCAL_CONFIG = path.join(STUDIO_DIR, '.local.json');

export const SOURCE_KINDS = ['agents', 'skills', 'actions', 'workflows'];

// Folder yang dibaca studio. Path relatif = relatif ke root repo doz-agent.
// `{workdir}` = folder project aktif, `~` = home. Folder pertama jadi tujuan file baru.
export const DEFAULT_SOURCES = {
  agents: ['plugins/agents', '{workdir}/.claude/agents'],
  skills: ['plugins/skills', '{workdir}/.claude/skills'],
  actions: ['plugins/actions'],
  workflows: ['plugins/workflows', '{workdir}/.claude/workflows'],
};

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

export const PORT = Number(argValue('--port') ?? process.env.DOZ_STUDIO_PORT ?? 4317);

// Folder project tempat agent bekerja. Bisa diganti dari UI (disimpan di studio/.local.json).
let workdir = path.resolve(argValue('--workdir') ?? process.env.DOZ_WORKDIR ?? readLocal().workdir ?? process.env.INIT_CWD ?? process.cwd());
let sources = { ...DEFAULT_SOURCES, ...(readLocal().sources ?? {}) };

export function getWorkdir() {
  return workdir;
}

export function setWorkdir(dir) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new Error(`Folder tidak ada: ${abs}`);
  workdir = abs;
  writeLocal({ ...readLocal(), workdir: abs });
  return abs;
}

export function resolveSource(entry) {
  const expanded = String(entry).replace('{workdir}', workdir).replace(/^~(?=$|[/\\])/, os.homedir());
  return path.resolve(REPO_ROOT, expanded);
}

export function getSources() {
  return sources;
}

// Folder absolut yang benar-benar ada, urut sesuai konfigurasi.
export function sourceDirs(kind) {
  return (sources[kind] ?? []).map(resolveSource).filter((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
}

// Tujuan file baru: folder pertama (dibuat kalau belum ada).
export function primaryDir(kind) {
  const first = sources[kind]?.[0];
  if (!first) throw new Error(`Belum ada folder ${kind}`);
  return resolveSource(first);
}

export function setSources(next) {
  const clean = {};
  for (const kind of SOURCE_KINDS) {
    const list = Array.isArray(next?.[kind]) ? next[kind] : sources[kind];
    clean[kind] = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  }
  sources = clean;
  writeLocal({ ...readLocal(), sources: clean });
  return clean;
}

export function isInside(dir, file) {
  const rel = path.relative(dir, file);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function runsDir(dir = workdir) {
  return path.join(dir, '.doz-studio', 'runs');
}

function readLocal() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

function writeLocal(data) {
  fs.writeFileSync(LOCAL_CONFIG, JSON.stringify(data, null, 2));
}
