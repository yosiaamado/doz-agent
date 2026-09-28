// Format workflow: file .md dengan frontmatter YAML (graph) + body markdown (catatan untuk semua agent).
// Spesifikasi lengkap: plugins/workflows/README.md
import YAML from 'yaml';

export const NODE_TYPES = ['start', 'agent', 'skill', 'condition', 'approval', 'info', 'output'];

// Pengaturan yang bisa diisi di `defaults` workflow atau di node agent/skill (node menang).
export const SETTING_KEYS = [
  'runner', 'model', 'effort', 'permission', 'inputs', 'max_turns',
  'timeout_min', 'retry', 'budget_usd', 'max_output_chars',
];

export const BUILTIN_DEFAULTS = {
  runner: 'claude-cli',
  model: 'inherit',
  effort: 'inherit',
  permission: 'inherit',
  inputs: 'previous',
  max_turns: 'inherit',
  timeout_min: 30,
  retry: 0,
  budget_usd: null,
  max_output_chars: 12000,
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseWorkflow(text, fallbackName = 'workflow') {
  const m = FRONTMATTER.exec(text);
  if (!m) throw new Error('File workflow harus diawali frontmatter YAML (---)');
  const meta = YAML.parse(m[1]) ?? {};
  return normalize({ ...meta, notes: m[2].trim() }, fallbackName);
}

export function normalize(wf, fallbackName = 'workflow') {
  return {
    name: String(wf.name ?? fallbackName),
    description: wf.description ?? '',
    defaults: { ...(wf.defaults ?? {}) },
    parallel: wf.parallel ?? 3,
    budget_usd: wf.budget_usd ?? null,
    nodes: (wf.nodes ?? []).map((n) => ({ ...n, id: String(n.id) })),
    edges: (wf.edges ?? []).map((e) => normalizeEdge(e)),
    layout: wf.layout ?? {},
    notes: wf.notes ?? '',
  };
}

function normalizeEdge(e) {
  if (Array.isArray(e)) return { from: String(e[0]), to: String(e[1]) };
  const out = { from: String(e.from), to: String(e.to) };
  if (e.when !== undefined && e.when !== null) out.when = Boolean(e.when);
  if (e.loop) out.loop = Number(e.loop);
  return out;
}

export function serializeWorkflow(wf) {
  const w = normalize(wf);
  const meta = { name: w.name };
  if (w.description) meta.description = w.description;
  const defaults = compact(w.defaults);
  if (Object.keys(defaults).length) meta.defaults = defaults;
  if (w.parallel !== 3) meta.parallel = w.parallel;
  if (w.budget_usd) meta.budget_usd = w.budget_usd;
  meta.nodes = w.nodes.map((n) => compact(n));
  meta.edges = w.edges;
  const layout = {};
  for (const [id, pos] of Object.entries(w.layout)) {
    if (w.nodes.some((n) => n.id === id)) layout[id] = pos.map((v) => Math.round(v));
  }
  meta.layout = layout;
  const doc = new YAML.Document(meta);
  // Edge dan posisi ditulis satu baris per item supaya diff git tetap pendek.
  for (const item of doc.get('edges').items) item.flow = true;
  for (const pair of doc.get('layout').items) pair.value.flow = true;
  for (const node of doc.get('nodes').items) {
    if (node.items.length <= 4 && !node.items.some((p) => String(p.value?.value ?? '').includes('\n'))) node.flow = true;
  }
  const yaml = doc.toString({ lineWidth: 0, flowCollectionPadding: true });
  return `---\n${yaml}---\n${w.notes ? `\n${w.notes.trim()}\n` : ''}`;
}

// Nilai kosong / "inherit" tidak ditulis, supaya file hanya berisi yang benar-benar diatur.
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v === undefined || v === null || v === '' || v === 'inherit') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

export function validateWorkflow(wf, agentNames = null) {
  const errors = [];
  const ids = new Set();
  for (const n of wf.nodes) {
    if (!n.id) errors.push('Ada node tanpa id');
    else if (ids.has(n.id)) errors.push(`id node dobel: ${n.id}`);
    ids.add(n.id);
    if (!NODE_TYPES.includes(n.type)) errors.push(`${n.id}: type tidak dikenal "${n.type}"`);
    if (n.type === 'agent' && !n.agent) errors.push(`${n.id}: node agent wajib punya "agent"`);
    if (n.type === 'agent' && agentNames && n.agent && !agentNames.includes(n.agent)) {
      errors.push(`${n.id}: agent "${n.agent}" tidak ada di plugins/agents`);
    }
    if (n.type === 'skill' && !n.skill) errors.push(`${n.id}: node skill wajib punya "skill"`);
    if (n.type === 'condition' && !n.check && !n.source) errors.push(`${n.id}: condition butuh "check" atau "source"`);
  }
  if (!wf.nodes.some((n) => n.type === 'start')) errors.push('Workflow butuh satu node start');
  const byId = Object.fromEntries(wf.nodes.map((n) => [n.id, n]));
  for (const e of wf.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) { errors.push(`edge ${e.from} → ${e.to}: node tidak ada`); continue; }
    const src = byId[e.from];
    const branching = src.type === 'condition' || src.type === 'approval';
    if (branching && e.when === undefined) errors.push(`edge ${e.from} → ${e.to}: keluar dari ${src.type} wajib punya when: true/false`);
    if (e.loop && !branching) errors.push(`edge ${e.from} → ${e.to}: loop hanya boleh keluar dari condition/approval`);
  }
  if (hasCycle(wf)) errors.push('Ada siklus tanpa loop. Tandai edge balik dengan "loop: <maks>"');
  return errors;
}

function hasCycle(wf) {
  const adj = {};
  for (const e of wf.edges) if (!e.loop) (adj[e.from] ??= []).push(e.to);
  const state = {};
  const visit = (id) => {
    if (state[id] === 1) return true;
    if (state[id] === 2) return false;
    state[id] = 1;
    for (const next of adj[id] ?? []) if (visit(next)) return true;
    state[id] = 2;
    return false;
  };
  return wf.nodes.some((n) => visit(n.id));
}

// node > defaults workflow > frontmatter agent > bawaan
export function resolveSettings(node, wf, agent) {
  const out = {};
  for (const key of SETTING_KEYS) {
    const candidates = [node[key], wf.defaults?.[key]];
    let v = candidates.find((c) => c !== undefined && c !== null && c !== '' && c !== 'inherit');
    if (v === undefined) {
      if (key === 'model') v = agent?.model;
      if (key === 'effort') v = agent?.effort;
      if (key === 'max_turns') v = agent?.maxTurns;
    }
    out[key] = v ?? (BUILTIN_DEFAULTS[key] === 'inherit' ? null : BUILTIN_DEFAULTS[key]);
  }
  return out;
}
