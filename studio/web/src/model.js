// Logika UI tanpa React: meta tipe node, konversi workflow ⇄ React Flow, dan reducer event run.

export const NODE_META = {
  start: { label: 'Start', glyph: '▶', hint: 'Titik awal. Menerima permintaan saat run dimulai.' },
  agent: { label: 'Agent', glyph: '◆', hint: 'Menjalankan satu subagent dari plugins/agents.' },
  skill: { label: 'Skill', glyph: '✦', hint: 'Menjalankan skill (mis. doz-agent:ship-feature). Hanya runner claude-cli.' },
  condition: { label: 'Condition', glyph: '⑂', hint: 'Memilih cabang ya/tidak dari VERDICT atau penilaian LLM.' },
  approval: { label: 'Approval', glyph: '✋', hint: 'Berhenti sampai kamu menyetujui atau menolak.' },
  info: { label: 'Info', glyph: 'ℹ', hint: 'Kotak informasi. Kalau disambung ke node, teksnya masuk ke konteks node itu.' },
  output: { label: 'Output', glyph: '■', hint: 'Mengumpulkan hasil node sebelumnya sebagai laporan akhir.' },
};

export const BRANCHING = new Set(['condition', 'approval']);

export const AGENT_COLORS = {
  purple: '#a78bfa', blue: '#60a5fa', orange: '#fb923c', cyan: '#22d3ee', yellow: '#facc15',
  green: '#4ade80', red: '#f87171', pink: '#f472b6',
};

const BUILTIN = { runner: 'claude-cli', inputs: 'previous', timeout_min: 30, retry: 0, max_output_chars: 12000 };

// Sama dengan resolveSettings di server: node > defaults workflow > agent > bawaan.
export function effectiveSetting(key, node, wf, agent) {
  for (const v of [node?.[key], wf?.defaults?.[key]]) {
    if (v !== undefined && v !== null && v !== '' && v !== 'inherit') return { value: v, from: v === node?.[key] ? 'node' : 'workflow' };
  }
  const fromAgent = { model: agent?.model, effort: agent?.effort, max_turns: agent?.maxTurns }[key];
  if (fromAgent) return { value: fromAgent, from: 'agent' };
  return { value: BUILTIN[key] ?? null, from: 'bawaan' };
}

export function emptyWorkflow(name) {
  return {
    name,
    description: '',
    defaults: { runner: 'claude-cli' },
    parallel: 3,
    budget_usd: null,
    notes: '',
    nodes: [{ id: 'start', type: 'start', label: 'Permintaan' }],
    edges: [],
    layout: { start: [0, 120] },
  };
}

export function edgeStyle(e, sourceType) {
  const branching = BRANCHING.has(sourceType);
  const label = e.loop ? `${e.when ? 'ya' : 'tidak'} · ulang ≤${e.loop}x` : branching ? (e.when ? 'ya' : 'tidak') : undefined;
  return {
    type: 'smoothstep',
    label,
    animated: Boolean(e.loop),
    className: e.loop ? 'edge-loop' : branching ? (e.when ? 'edge-yes' : 'edge-no') : '',
  };
}

export function toFlow(wf) {
  const types = Object.fromEntries(wf.nodes.map((n) => [n.id, n.type]));
  const nodes = wf.nodes.map((n, i) => {
    const pos = wf.layout?.[n.id] ?? [i * 260, 120];
    return { id: n.id, type: 'doz', position: { x: pos[0], y: pos[1] }, data: { node: n } };
  });
  const edges = wf.edges.map((e, i) => ({
    id: `e${i}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    sourceHandle: e.when === undefined ? null : String(e.when),
    data: { when: e.when, loop: e.loop },
    ...edgeStyle(e, types[e.from]),
  }));
  return { nodes, edges };
}

export function fromFlow(meta, nodes, edges) {
  const layout = {};
  for (const n of nodes) layout[n.id] = [Math.round(n.position.x), Math.round(n.position.y)];
  return {
    ...meta,
    nodes: nodes.map((n) => n.data.node),
    edges: edges.map((e) => {
      const out = { from: e.source, to: e.target };
      if (e.data?.when !== undefined && e.data?.when !== null) out.when = e.data.when;
      if (e.data?.loop) out.loop = e.data.loop;
      return out;
    }),
    layout,
  };
}

export function uniqueId(base, existing) {
  const slug = String(base).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node';
  if (!existing.has(slug)) return slug;
  let i = 2;
  while (existing.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

export function validate(wf, agentNames) {
  const errors = [];
  const ids = new Set(wf.nodes.map((n) => n.id));
  if (!wf.nodes.some((n) => n.type === 'start')) errors.push('Butuh satu node Start');
  for (const n of wf.nodes) {
    if (n.type === 'agent' && !agentNames.includes(n.agent)) errors.push(`${n.label || n.id}: pilih agent`);
    if (n.type === 'skill' && !n.skill) errors.push(`${n.label || n.id}: pilih skill`);
    if (n.type === 'condition' && !n.check && !n.source) errors.push(`${n.label || n.id}: isi pertanyaan atau sumber`);
  }
  const types = Object.fromEntries(wf.nodes.map((n) => [n.id, n.type]));
  for (const e of wf.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    if (BRANCHING.has(types[e.from]) && e.when === undefined) errors.push(`Garis dari ${e.from}: pilih cabang ya/tidak`);
  }
  return errors;
}

// ---- Run ----

export function emptyRun(id = null) {
  return { id, workflow: null, source: null, status: 'idle', cost: 0, error: null, input: '', nodes: {}, log: [] };
}

export function reduceRun(run, ev) {
  const next = { ...run, nodes: { ...run.nodes } };
  const logItem = (text, kind = ev.type) => {
    next.log = [...run.log, { ts: ev.ts ?? Date.now(), node: ev.node ?? null, kind, text }].slice(-1500);
  };
  switch (ev.type) {
    case 'run_start':
      next.workflow = ev.workflow;
      next.source = ev.source ?? next.source;
      next.status = 'running';
      next.input = ev.input ?? '';
      logItem(`Run dimulai${ev.source === 'claude-code' ? ' dari Claude Code' : ''}: ${ev.workflow}`);
      break;
    case 'node': {
      const prev = run.nodes[ev.node] ?? {};
      const patch = { ...ev };
      delete patch.type; delete patch.ts; delete patch.run; delete patch.node; delete patch.source;
      if (patch.summary && !patch.output) patch.output = patch.summary;
      next.nodes[ev.node] = { ...prev, ...patch };
      if (ev.status && ev.status !== prev.status) {
        const extra = ev.status === 'failed' ? `: ${ev.error ?? ''}` : ev.verdict !== undefined && ev.verdict !== null ? ` (${ev.verdict ? 'PASS/ya' : 'FAIL/tidak'})` : '';
        logItem(`${ev.status}${extra}`, 'status');
      }
      break;
    }
    case 'activity': {
      const prev = run.nodes[ev.node] ?? {};
      next.nodes[ev.node] = { ...prev, activity: ev.text, model: ev.model ?? prev.model };
      logItem(ev.text, ev.kind ?? 'activity');
      break;
    }
    case 'loop':
      logItem(`Loop ${ev.edge} ke-${ev.count} dari ${ev.max}`);
      break;
    case 'cost':
      next.cost = ev.total;
      break;
    case 'run_end':
      next.status = ev.status ?? 'done';
      if (ev.cost !== undefined) next.cost = ev.cost;
      next.error = ev.error ?? null;
      logItem(`Run selesai: ${next.status}${ev.error ? ` (${ev.error})` : ''}`);
      break;
    default:
  }
  return next;
}

export function formatCost(v) {
  if (!v) return '$0';
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

export function formatTokens(u) {
  if (!u) return '';
  const total = (u.input ?? 0) + (u.output ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
  return total > 1000 ? `${(total / 1000).toFixed(1)}k tok` : `${total} tok`;
}

export function formatDuration(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}d` : `${Math.floor(s / 60)}m ${s % 60}d`;
}
