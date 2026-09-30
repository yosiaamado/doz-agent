// Repository komponen (agent, skill, action, file workflow) yang tersebar di beberapa folder sumber.
import fs from 'node:fs';
import path from 'node:path';
import { splitFile, composeFile } from '../lib/frontmatter.js';
import { displayPath, isInside } from '../lib/paths.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';

export const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
export const COMPONENT_KINDS = Object.freeze(['agents', 'skills', 'actions']);
const WORKFLOW_REF = { agents: 'agent', skills: 'skill', actions: 'action' };

function mdFiles(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => path.join(dir, f));
}

function safeRead(file) {
  try {
    return splitFile(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Nama sama di dua folder → yang pertama dipakai, sisanya ditandai `shadowed`.
function markShadowed(items) {
  const seen = new Set();
  return items.map((it) => {
    const shadowed = seen.has(it.name);
    seen.add(it.name);
    return { ...it, shadowed };
  });
}

function skillFiles(dir) {
  const visit = (d, depth) => fs.readdirSync(d, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .flatMap((e) => {
      const sub = path.join(d, e.name);
      if (fs.existsSync(path.join(sub, 'SKILL.md'))) return [path.join(sub, 'SKILL.md')];
      return depth < 2 ? visit(sub, depth + 1) : [];
    });
  return visit(dir, 1);
}

function parseTools(tools) {
  if (typeof tools === 'string') return tools.split(',').map((t) => t.trim()).filter(Boolean);
  return Array.isArray(tools) ? tools : [];
}

export function createComponentRepository(config) {
  const show = (file) => displayPath(file, { workdir: config.getWorkdir(), repoRoot: config.repoRoot });

  const toAgent = (file, f, dir) => {
    const tools = parseTools(f.meta.tools);
    return {
      kind: 'agents',
      name: String(f.meta.name ?? path.basename(file, '.md')),
      description: f.meta.description ?? '',
      tools,
      model: f.meta.model ?? null,
      effort: f.meta.effort ?? null,
      maxTurns: f.meta.maxTurns ?? null,
      color: f.meta.color ?? null,
      canEdit: tools.includes('Edit') || tools.includes('Write'),
      prompt: f.body.trim(),
      path: file,
      file: show(file),
      dir,
    };
  };

  const toSkill = (file, f, dir) => {
    const prefix = dir === config.pluginDir || isInside(config.pluginDir, dir) ? 'doz-agent:' : '';
    const base = String(f.meta.name ?? path.basename(path.dirname(file)));
    const rel = path.relative(dir, path.dirname(file)).split(path.sep);
    return {
      kind: 'skills',
      name: `${prefix}${base}`,
      short: base,
      area: rel.length > 1 ? rel[0] : null,
      description: f.meta.description ?? '',
      argumentHint: f.meta['argument-hint'] ?? '',
      path: file,
      file: show(file),
      dir,
    };
  };

  const toAction = (file, f, dir) => ({
    kind: 'actions',
    name: String(f.meta.name ?? path.basename(file, '.md')),
    description: f.meta.description ?? '',
    command: f.meta.command ?? '',
    timeout_min: f.meta.timeout_min ?? null,
    notes: f.body.trim(),
    path: file,
    file: show(file),
    dir,
  });

  const collect = (kind, filesOf, toItem) => markShadowed(
    config.sourceDirs(kind)
      .flatMap((dir) => filesOf(dir).map((file) => ({ file, dir, parsed: safeRead(file) })))
      .filter((x) => x.parsed)
      .map((x) => toItem(x.file, x.parsed, x.dir))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const listers = {
    agents: () => collect('agents', mdFiles, toAgent),
    skills: () => collect('skills', skillFiles, toSkill),
    actions: () => collect('actions', mdFiles, toAction),
    workflows: () => markShadowed(config.sourceDirs('workflows').flatMap((dir) => mdFiles(dir)
      .map((file) => ({ name: path.basename(file, '.md'), path: file, file: show(file), dir })))),
  };

  const list = (kind) => {
    const lister = listers[kind];
    if (!lister) throw badRequest(`Unknown kind: ${kind}`, { code: 'KIND_UNKNOWN', params: { kind: String(kind).slice(0, 50) } });
    return lister();
  };

  const find = (kind, name) => list(kind).find((x) => x.name === name && !x.shadowed) ?? null;

  const usedBy = (kind, name) => {
    const key = WORKFLOW_REF[kind];
    if (!key) return [];
    return list('workflows')
      .filter((wf) => safeRead(wf.path)?.meta?.nodes?.some?.((n) => n[key] === name))
      .map((wf) => wf.name);
  };

  const read = (kind, name) => {
    const item = find(kind, name);
    if (!item) throw notFound(`${kind} "${name}" not found`, { code: 'COMPONENT_NOT_FOUND', params: { kind, name: String(name).slice(0, 100) } });
    const text = fs.readFileSync(item.path, 'utf8');
    const parts = splitFile(text);
    return { ...item, text, meta: parts.meta, body: parts.body, strict: parts.strict, usedBy: usedBy(kind, name) };
  };

  // Update file yang sudah ada: `text` (mode raw) atau `meta` + `body` (mode form).
  const update = (kind, name, { text, meta, body }) => {
    const item = find(kind, name);
    if (!item) throw notFound(`${kind} "${name}" not found`, { code: 'COMPONENT_NOT_FOUND', params: { kind, name: String(name).slice(0, 100) } });
    let next;
    try {
      next = text ?? composeFile(fs.readFileSync(item.path, 'utf8'), meta, body);
    } catch (err) {
      throw badRequest(err.message);
    }
    if (!splitFile(next).raw) throw badRequest('The file must start with frontmatter (---)', { code: 'FRONTMATTER_REQUIRED' });
    fs.writeFileSync(item.path, next);
    return read(kind, name);
  };

  const targetFile = (kind, dir, name, area) => {
    if (kind !== 'skills') return path.join(dir, `${name}.md`);
    if (area && !NAME_RE.test(area)) throw badRequest('Invalid area name', { code: 'NAME_INVALID' });
    return path.join(dir, area ?? '', name, 'SKILL.md');
  };

  // Membuat file baru di salah satu folder sumber yang terdaftar.
  const create = (kind, { name, dir, area, meta, body }) => {
    if (!NAME_RE.test(name ?? '')) throw badRequest('The name may only contain letters, digits, - and _', { code: 'NAME_INVALID' });
    const allowed = config.allowedDirs(kind);
    const target = dir ? path.resolve(dir) : allowed[0];
    if (!allowed.includes(target)) throw badRequest('The target folder must be one of the source folders', { code: 'TARGET_NOT_SOURCE' });
    const file = targetFile(kind, target, name, area);
    if (fs.existsSync(file)) throw conflict(`Already exists: ${show(file)}`, { code: 'ALREADY_EXISTS', params: { path: show(file) } });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, composeFile('', { name, ...meta }, body ?? ''));
    const isPluginSkill = kind === 'skills' && (target === config.pluginDir || isInside(config.pluginDir, target));
    return read(kind, isPluginSkill ? `doz-agent:${name}` : name);
  };

  return { list, find, read, update, create, usedBy };
}
