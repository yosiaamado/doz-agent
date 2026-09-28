// Logika UI tanpa React: meta tipe node, konversi workflow ⇄ React Flow, reducer event run, dan warna garis.

export const NODE_META = {
  start: { label: 'Start', hint: 'Titik awal. Menerima permintaan saat run dimulai.' },
  agent: { label: 'Agent', hint: 'Menjalankan satu subagent.' },
  skill: { label: 'Skill', hint: 'Menjalankan skill (mis. doz-agent:ship-feature). Hanya runner claude-cli.' },
  action: { label: 'Action', hint: 'Perintah shell di folder project (test, lint, build). Exit 0 = PASS.' },
  condition: { label: 'Condition', hint: 'Memilih cabang ya/tidak dari VERDICT, exit code, atau penilaian LLM.' },
  approval: { label: 'Approval', hint: 'Berhenti sampai kamu menyetujui atau menolak.' },
  info: { label: 'Catatan', hint: 'Sticky note. Kalau disambung ke node, teksnya masuk ke konteks node itu.' },
  output: { label: 'Output', hint: 'Mengumpulkan hasil semua langkah kerja sebelumnya jadi laporan akhir.' },
};

export const BRANCHING = new Set(['condition', 'approval']);
export const WORK = new Set(['agent', 'skill', 'action']);

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

export function toFlow(wf) {
  const nodes = wf.nodes.map((n, i) => {
    const pos = wf.layout?.[n.id] ?? [i * 280, 120];
    const flowNode = { id: n.id, type: n.type === 'info' ? 'note' : 'doz', position: { x: pos[0], y: pos[1] }, data: { node: n } };
    if (n.type === 'info') {
      flowNode.style = { width: pos[2] ?? 260, height: pos[3] ?? 160 };
      flowNode.zIndex = -1;
    }
    return flowNode;
  });
  const edges = wf.edges.map((e, i) => ({
    id: `e${i}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    sourceHandle: e.when === undefined ? null : String(e.when),
    data: { when: e.when, loop: e.loop },
  }));
  return { nodes, edges };
}

export function fromFlow(meta, nodes, edges) {
  const layout = {};
  for (const n of nodes) {
    const pos = [Math.round(n.position.x), Math.round(n.position.y)];
    if (n.data.node.type === 'info') {
      pos.push(Math.round(n.measured?.width ?? n.width ?? n.style?.width ?? 260), Math.round(n.measured?.height ?? n.height ?? n.style?.height ?? 160));
    }
    layout[n.id] = pos;
  }
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
    if (n.type === 'agent' && !agentNames.includes(n.agent)) errors.push(`${n.label || n.id}: agent "${n.agent ?? ''}" tidak ada`);
    if (n.type === 'skill' && !n.skill) errors.push(`${n.label || n.id}: pilih skill`);
    if (n.type === 'action' && !n.command && !n.action) errors.push(`${n.label || n.id}: isi perintah`);
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
  return {
    id, workflow: null, source: null, status: 'idle', cost: 0, error: null, input: '',
    startedAt: null, endedAt: null, nodes: {}, order: [], loops: {}, log: [],
  };
}

export function totalTokens(u) {
  if (!u) return 0;
  return (u.input ?? 0) + (u.output ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
}

const FINAL = new Set(['done', 'failed', 'stopped']);

export function reduceRun(run, ev) {
  const next = { ...run, nodes: { ...run.nodes } };
  const logItem = (text, kind = ev.type) => {
    next.log = [...run.log, { ts: ev.ts ?? Date.now(), node: ev.node ?? null, kind, text }].slice(-2000);
  };
  switch (ev.type) {
    case 'run_start':
      next.workflow = ev.workflow;
      next.source = ev.source ?? next.source;
      next.status = 'running';
      next.input = ev.input ?? '';
      next.startedAt = ev.ts ?? Date.now();
      logItem(`Run dimulai${ev.source === 'claude-code' ? ' dari Claude Code' : ''}: ${ev.workflow}`);
      break;
    case 'node': {
      const prev = run.nodes[ev.node] ?? { history: [] };
      const patch = { ...ev };
      for (const k of ['type', 'ts', 'run', 'node', 'source']) delete patch[k];
      if (patch.summary && !patch.output) patch.output = patch.summary;
      if (ev.status === 'running' && !patch.startedAt) patch.startedAt = ev.ts ?? Date.now();
      if (FINAL.has(ev.status) && !patch.endedAt) patch.endedAt = ev.ts ?? Date.now();
      // Eksekusi baru (loop/ulang): mulai dari nol, riwayat dipertahankan.
      const fresh = ev.status === 'running' && prev.status !== 'running';
      const merged = fresh ? { history: prev.history ?? [], ...patch } : { ...prev, ...patch };
      if (FINAL.has(ev.status) && merged.startedAt && !merged.durationMs) merged.durationMs = merged.endedAt - merged.startedAt;
      // Satu entri riwayat per eksekusi node (loop dan retry bikin node jalan lebih dari sekali).
      if (FINAL.has(ev.status) && prev.status === 'running') {
        merged.history = [...(prev.history ?? []), {
          status: ev.status, startedAt: merged.startedAt, endedAt: merged.endedAt, durationMs: merged.durationMs,
          usage: merged.usage, cost: merged.cost, loop: merged.loop ?? 0, attempts: merged.attempts ?? 1,
          verdict: merged.verdict, changes: merged.changes?.length ?? merged.touched?.length ?? 0, error: merged.error,
        }];
      }
      next.nodes[ev.node] = merged;
      if (ev.status === 'running' && !run.order.includes(ev.node)) next.order = [...run.order, ev.node];
      if (ev.status && ev.status !== prev.status) {
        const extra = ev.status === 'failed' ? `: ${ev.error ?? ''}` : typeof ev.verdict === 'boolean' ? ` (${ev.verdict ? 'PASS/ya' : 'FAIL/tidak'})` : '';
        logItem(`${ev.status}${extra}`, 'status');
      }
      break;
    }
    case 'activity': {
      const prev = run.nodes[ev.node] ?? { history: [] };
      next.nodes[ev.node] = { ...prev, activity: ev.text, model: ev.model ?? prev.model };
      logItem(ev.text, ev.kind ?? 'activity');
      break;
    }
    case 'loop':
      next.loops = { ...run.loops, [ev.edge]: ev.count };
      logItem(`Loop ${ev.edge} ke-${ev.count} dari ${ev.max}`);
      break;
    case 'cost':
      next.cost = ev.total;
      break;
    case 'run_end':
      next.status = ev.status ?? 'done';
      if (ev.cost !== undefined) next.cost = ev.cost;
      next.error = ev.error ?? null;
      next.endedAt = ev.ts ?? Date.now();
      logItem(`Run selesai: ${next.status}${ev.error ? ` (${ev.error})` : ''}`);
      break;
    default:
  }
  return next;
}

export function runTokens(run) {
  let sum = 0;
  for (const n of Object.values(run.nodes)) {
    const hist = n.history ?? [];
    sum += hist.reduce((acc, h) => acc + totalTokens(h.usage), 0);
    if (n.status === 'running') sum += totalTokens(n.usage);
  }
  return sum;
}

// Status garis: 'done' (hijau, aliran sudah lewat), 'active' (biru, menuju node yang sedang jalan), atau null.
export function edgeState(edge, run, sourceType) {
  if (run.status === 'idle') return null;
  const src = run.nodes[edge.source];
  const tgt = run.nodes[edge.target];
  if (edge.data?.loop) {
    const count = run.loops[`${edge.source}->${edge.target}`];
    if (!count) return null;
    return tgt?.status === 'running' || tgt?.status === 'waiting' ? 'active' : 'done';
  }
  if (src?.status !== 'done') return null;
  if (BRANCHING.has(sourceType) && edge.data?.when !== undefined && src.verdict !== edge.data.when) return 'dim';
  if (tgt?.status === 'running' || tgt?.status === 'waiting') return 'active';
  if (tgt?.status === 'skipped') return 'dim';
  return 'done';
}

export function formatCost(v) {
  if (!v) return '$0';
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

export function formatTokens(n) {
  if (!n) return '0 token';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k token` : `${n} token`;
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}d`;
  return `${Math.floor(s / 60)}m ${s % 60}d`;
}

export function formatTime(ts) {
  return ts ? new Date(ts).toLocaleTimeString('id-ID', { hour12: false }) : '';
}
