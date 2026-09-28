import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const STUDIO_DIR = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(STUDIO_DIR, '..');
export const PLUGIN_DIR = path.join(REPO_ROOT, 'plugins');
export const AGENTS_DIR = path.join(PLUGIN_DIR, 'agents');
export const SKILLS_DIR = path.join(PLUGIN_DIR, 'skills');
export const WORKFLOWS_DIR = path.join(PLUGIN_DIR, 'workflows');
const LOCAL_CONFIG = path.join(STUDIO_DIR, '.local.json');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

export const PORT = Number(argValue('--port') ?? process.env.DOZ_STUDIO_PORT ?? 4317);

// Folder project tempat agent bekerja. Bisa diganti dari UI (disimpan di studio/.local.json).
let workdir = path.resolve(argValue('--workdir') ?? process.env.DOZ_WORKDIR ?? readLocal().workdir ?? process.env.INIT_CWD ?? process.cwd());

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
