// Membaca dan menulis komponen dari folder sumber: agent, skill, action, workflow.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { PLUGIN_DIR, REPO_ROOT, getWorkdir, getSources, resolveSource, sourceDirs, isInside } from './config.js';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
export const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

// Claude Code membaca frontmatter dengan longgar (mis. description berisi ": "), jadi YAML ketat
// dicoba dulu lalu jatuh ke parser baris `key: value`.
export function parseFrontmatter(raw) {
  try {
    return { meta: YAML.parse(raw) ?? {}, strict: true };
  } catch {
    const meta = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
      if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return { meta, strict: false };
  }
}

export function splitFile(text) {
  const m = FRONTMATTER.exec(text);
  if (!m) return { raw: '', meta: {}, body: text, strict: true };
  return { raw: m[1], body: m[2].replace(/^\r?\n/, ''), ...parseFrontmatter(m[1]) };
}

// Mengubah key frontmatter tanpa membuang key lain dan komentar. null/'' = hapus key.
export function composeFile(existingText, patch, body) {
  const current = existingText ? splitFile(existingText) : { raw: '', body: '' };
  const doc = current.raw ? YAML.parseDocument(current.raw) : new YAML.Document({});
  if (doc.errors.length) throw new Error('Frontmatter file ini bukan YAML ketat. Edit lewat mode Raw.');
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key === 'name' && existingText) continue; // ganti nama = file baru, bukan edit
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) doc.delete(key);
    else doc.set(key, value);
  }
  const yaml = doc.toString({ lineWidth: 0 }).trimEnd();
  const text = body ?? current.body;
  return `---\n${yaml}\n---\n\n${text.trim()}\n`;
}

function display(file) {
  const wd = getWorkdir();
  if (isInside(wd, file)) return `{workdir}/${path.relative(wd, file).split(path.sep).join('/')}`;
  if (isInside(REPO_ROOT, file)) return path.relative(REPO_ROOT, file).split(path.sep).join('/');
  return file;
}

function mdFiles(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => path.join(dir, f));
}

function dedupe(items) {
  const seen = new Set();
  for (const it of items) {
    it.shadowed = seen.has(it.name);
    seen.add(it.name);
  }
  return items;
}

function safeRead(file) {
  try {
    return splitFile(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function listAgents() {
  const out = [];
  for (const dir of sourceDirs('agents')) {
    for (const file of mdFiles(dir)) {
      const f = safeRead(file);
      if (!f) continue;
      const meta = f.meta;
      const tools = typeof meta.tools === 'string' ? meta.tools.split(',').map((t) => t.trim()).filter(Boolean) : meta.tools ?? [];
      out.push({
        kind: 'agents',
        name: String(meta.name ?? path.basename(file, '.md')),
        description: meta.description ?? '',
        tools,
        model: meta.model ?? null,
        effort: meta.effort ?? null,
        maxTurns: meta.maxTurns ?? null,
        color: meta.color ?? null,
        canEdit: tools.some((t) => t === 'Edit' || t === 'Write'),
        prompt: f.body.trim(),
        path: file,
        file: display(file),
        dir,
      });
    }
  }
  return dedupe(out.sort((a, b) => a.name.localeCompare(b.name)));
}

function skillFiles(dir) {
  const out = [];
  const visit = (d, depth) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const sub = path.join(d, e.name);
      if (fs.existsSync(path.join(sub, 'SKILL.md'))) out.push(path.join(sub, 'SKILL.md'));
      else if (depth < 2) visit(sub, depth + 1);
    }
  };
  visit(dir, 1);
  return out;
}

export function listSkills() {
  const out = [];
  for (const dir of sourceDirs('skills')) {
    const prefix = isInside(PLUGIN_DIR, dir) || dir === PLUGIN_DIR ? 'doz-agent:' : '';
    for (const file of skillFiles(dir)) {
      const f = safeRead(file);
      if (!f) continue;
      const base = String(f.meta.name ?? path.basename(path.dirname(file)));
      const rel = path.relative(dir, path.dirname(file)).split(path.sep);
      out.push({
        kind: 'skills',
        name: `${prefix}${base}`,
        short: base,
        area: rel.length > 1 ? rel[0] : null,
        description: f.meta.description ?? '',
        argumentHint: f.meta['argument-hint'] ?? '',
        path: file,
        file: display(file),
        dir,
      });
    }
  }
  return dedupe(out.sort((a, b) => a.name.localeCompare(b.name)));
}

export function listActions() {
  const out = [];
  for (const dir of sourceDirs('actions')) {
    for (const file of mdFiles(dir)) {
      const f = safeRead(file);
      if (!f) continue;
      out.push({
        kind: 'actions',
        name: String(f.meta.name ?? path.basename(file, '.md')),
        description: f.meta.description ?? '',
        command: f.meta.command ?? '',
        timeout_min: f.meta.timeout_min ?? null,
        notes: f.body.trim(),
        path: file,
        file: display(file),
        dir,
      });
    }
  }
  return dedupe(out.sort((a, b) => a.name.localeCompare(b.name)));
}

export function listWorkflowFiles() {
  const out = [];
  for (const dir of sourceDirs('workflows')) {
    for (const file of mdFiles(dir)) out.push({ name: path.basename(file, '.md'), path: file, file: display(file), dir });
  }
  return dedupe(out);
}

const LISTERS = { agents: listAgents, skills: listSkills, actions: listActions, workflows: listWorkflowFiles };

export function findItem(kind, name) {
  const lister = LISTERS[kind];
  if (!lister) throw Object.assign(new Error(`jenis tidak dikenal: ${kind}`), { status: 400 });
  return lister().find((x) => x.name === name && !x.shadowed) ?? null;
}

export function readItem(kind, name) {
  const item = findItem(kind, name);
  if (!item) throw Object.assign(new Error(`${kind} "${name}" tidak ditemukan`), { status: 404 });
  const text = fs.readFileSync(item.path, 'utf8');
  const parts = splitFile(text);
  return { ...item, text, meta: parts.meta, body: parts.body, strict: parts.strict, usedBy: usedBy(kind, name) };
}

// Workflow yang memakai komponen ini, supaya user tahu dampak edit.
export function usedBy(kind, name) {
  if (kind === 'workflows') return [];
  const key = { agents: 'agent', skills: 'skill', actions: 'action' }[kind];
  const out = [];
  for (const wf of listWorkflowFiles()) {
    const f = safeRead(wf.path);
    if (f?.meta?.nodes?.some?.((n) => n[key] === name)) out.push(wf.name);
  }
  return out;
}

// Update file yang sudah ada: `text` (mode raw) atau `meta` + `body` (mode form).
export function updateItem(kind, name, { text, meta, body }) {
  const item = findItem(kind, name);
  if (!item) throw Object.assign(new Error(`${kind} "${name}" tidak ditemukan`), { status: 404 });
  const next = text ?? composeFile(fs.readFileSync(item.path, 'utf8'), meta, body);
  if (!splitFile(next).raw) throw Object.assign(new Error('File harus diawali frontmatter (---)'), { status: 400 });
  fs.writeFileSync(item.path, next);
  return readItem(kind, name);
}

// Membuat file baru di salah satu folder sumber.
export function createItem(kind, { name, dir, area, meta, body }) {
  if (!NAME_RE.test(name ?? '')) throw Object.assign(new Error('nama hanya boleh huruf, angka, - dan _'), { status: 400 });
  const allowed = (getSources()[kind] ?? []).map(resolveSource);
  const target = dir ? path.resolve(dir) : allowed[0];
  if (!allowed.includes(target)) throw Object.assign(new Error('folder tujuan harus salah satu folder sumber'), { status: 400 });
  let file;
  if (kind === 'skills') {
    if (area && !NAME_RE.test(area)) throw Object.assign(new Error('nama bidang tidak valid'), { status: 400 });
    file = path.join(target, area ?? '', name, 'SKILL.md');
  } else {
    file = path.join(target, `${name}.md`);
  }
  if (fs.existsSync(file)) throw Object.assign(new Error(`sudah ada: ${display(file)}`), { status: 409 });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, composeFile('', { name, ...meta }, body ?? ''));
  return readItem(kind, kind === 'skills' && isInside(PLUGIN_DIR, target) ? `doz-agent:${name}` : name);
}
