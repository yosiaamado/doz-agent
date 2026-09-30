// UI logic without React: node type meta, workflow ⇄ React Flow conversion, the run event reducer, and edge colors.
// Text shown to the user is an i18n key, translated at the render site. The formatters take `t`/`intl` from useI18n().
import { translate } from '../i18n/index.js';

const tEn = (key, vars) => translate('en', key, vars);

export const NODE_META = {
  start: { label: 'canvas.node.start.label', hint: 'canvas.node.start.hint' },
  agent: { label: 'canvas.node.agent.label', hint: 'canvas.node.agent.hint' },
  skill: { label: 'canvas.node.skill.label', hint: 'canvas.node.skill.hint' },
  action: { label: 'canvas.node.action.label', hint: 'canvas.node.action.hint' },
  condition: { label: 'canvas.node.condition.label', hint: 'canvas.node.condition.hint' },
  approval: { label: 'canvas.node.approval.label', hint: 'canvas.node.approval.hint' },
  info: { label: 'canvas.node.info.label', hint: 'canvas.node.info.hint' },
  output: { label: 'canvas.node.output.label', hint: 'canvas.node.output.hint' },
};

// The translated label / hint for a node type; null when the type is unknown.
export const nodeTypeLabel = (t, type) => (Object.hasOwn(NODE_META, type) ? t(NODE_META[type].label) : null);
export const nodeTypeHint = (t, type) => (Object.hasOwn(NODE_META, type) ? t(NODE_META[type].hint) : '');

const STATUS_KEY = {
  running: 'common.status.running', done: 'common.status.done', failed: 'common.status.failed', skipped: 'common.status.skipped',
  waiting: 'common.status.waiting', stopped: 'common.status.stopped', pending: 'common.status.pending',
};

// The translated label for a run/node status; an unknown status is shown as-is.
export const statusLabel = (t, status) => (Object.hasOwn(STATUS_KEY, status) ? t(STATUS_KEY[status]) : (status ?? ''));

export const BRANCHING = new Set(['condition', 'approval']);
export const WORK = new Set(['agent', 'skill', 'action']);

export const AGENT_COLORS = {
  purple: '#a78bfa', blue: '#60a5fa', orange: '#fb923c', cyan: '#22d3ee', yellow: '#facc15',
  green: '#4ade80', red: '#f87171', pink: '#f472b6',
};

const BUILTIN = { runner: 'claude-cli', inputs: 'previous', timeout_min: 30, retry: 0, max_output_chars: 12000 };

// Same as resolveSettings on the server: node > workflow defaults > agent > built-in.
export function effectiveSetting(key, node, wf, agent) {
  for (const v of [node?.[key], wf?.defaults?.[key]]) {
    if (v !== undefined && v !== null && v !== '' && v !== 'inherit') return { value: v, from: v === node?.[key] ? 'node' : 'workflow' };
  }
  const fromAgent = { model: agent?.model, effort: agent?.effort, max_turns: agent?.maxTurns }[key];
  if (fromAgent) return { value: fromAgent, from: 'agent' };
  return { value: BUILTIN[key] ?? null, from: 'builtin' };
}

export function emptyWorkflow(name) {
  return {
    name,
    description: '',
    defaults: { runner: 'claude-cli' },
    parallel: 3,
    budget_usd: null,
    notes: '',
    // i18n-ignore: a default label written into the workflow file, not UI copy
    nodes: [{ id: 'start', type: 'start', label: 'Request' }],
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

export function validate(wf, agentNames, t = tEn) {
  const errors = [];
  const ids = new Set(wf.nodes.map((n) => n.id));
  if (!wf.nodes.some((n) => n.type === 'start')) errors.push(t('canvas.validate.need-start'));
  for (const n of wf.nodes) {
    const label = n.label || n.id;
    if (n.type === 'agent' && !agentNames.includes(n.agent)) errors.push(t('canvas.validate.agent-missing', { label, agent: n.agent ?? '' }));
    if (n.type === 'skill' && !n.skill) errors.push(t('canvas.validate.skill-missing', { label }));
    if (n.type === 'action' && !n.command && !n.action) errors.push(t('canvas.validate.action-missing', { label }));
    if (n.type === 'condition' && !n.check && !n.source) errors.push(t('canvas.validate.condition-missing', { label }));
  }
  const types = Object.fromEntries(wf.nodes.map((n) => [n.id, n.type]));
  for (const e of wf.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    if (BRANCHING.has(types[e.from]) && e.when === undefined) errors.push(t('canvas.validate.edge-branch', { from: e.from }));
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
  // Text from the server/Claude (activity) is used as-is; studio-authored messages are stored as a key + params
  // (`msg`) so they follow the language, with the English `text` as a fallback.
  const push = (entry) => {
    next.log = [...run.log, { ts: ev.ts ?? Date.now(), node: ev.node ?? null, ...entry }].slice(-2000);
  };
  const logItem = (text, kind = ev.type) => push({ kind, text });
  const logMsg = (key, params, kind = ev.type, fallback) => push({ kind, text: fallback ?? translate('en', key, params), msg: { key, params } });
  switch (ev.type) {
    case 'run_start':
      next.workflow = ev.workflow;
      next.source = ev.source ?? next.source;
      next.status = 'running';
      next.input = ev.input ?? '';
      next.startedAt = ev.ts ?? Date.now();
      logMsg(ev.source === 'claude-code' ? 'logs.event.run-start-cc' : 'logs.event.run-start', { workflow: ev.workflow });
      break;
    case 'node': {
      const prev = run.nodes[ev.node] ?? { history: [] };
      const patch = { ...ev };
      for (const k of ['type', 'ts', 'run', 'node', 'source']) delete patch[k];
      if (patch.summary && !patch.output) patch.output = patch.summary;
      // activityCode null = the activity was cleared; no stale code may stick around.
      if ('activity' in patch && !('activityCode' in patch)) patch.activityCode = null;
      if (ev.status === 'running' && !patch.startedAt) patch.startedAt = ev.ts ?? Date.now();
      if (FINAL.has(ev.status) && !patch.endedAt) patch.endedAt = ev.ts ?? Date.now();
      // A new execution (loop/retry): start from zero, keep the history.
      const fresh = ev.status === 'running' && prev.status !== 'running';
      const merged = fresh ? { history: prev.history ?? [], ...patch } : { ...prev, ...patch };
      if (FINAL.has(ev.status) && merged.startedAt && !merged.durationMs) merged.durationMs = merged.endedAt - merged.startedAt;
      // One history entry per node execution (loops and retries make a node run more than once).
      if (FINAL.has(ev.status) && prev.status === 'running') {
        merged.history = [...(prev.history ?? []), {
          status: ev.status, startedAt: merged.startedAt, endedAt: merged.endedAt, durationMs: merged.durationMs,
          usage: merged.usage, cost: merged.cost, loop: merged.loop ?? 0, attempts: merged.attempts ?? 1,
          verdict: merged.verdict, changes: merged.changes?.length ?? merged.touched?.length ?? 0, error: merged.error, errorCode: merged.errorCode, errorParams: merged.errorParams,
        }];
      }
      next.nodes[ev.node] = merged;
      if (ev.status === 'running' && !run.order.includes(ev.node)) next.order = [...run.order, ev.node];
      if (ev.status && ev.status !== prev.status) {
        const params = { status: ev.status, error: ev.error ?? '', errorCode: ev.errorCode ?? null, errorParams: ev.errorParams ?? null };
        const key = ev.status === 'failed' ? 'logs.event.status-failed'
          : typeof ev.verdict === 'boolean' ? (ev.verdict ? 'logs.event.status-pass' : 'logs.event.status-fail')
            : 'logs.event.status';
        logMsg(key, params, 'status');
      }
      break;
    }
    case 'activity': {
      const prev = run.nodes[ev.node] ?? { history: [] };
      next.nodes[ev.node] = { ...prev, activity: ev.text, activityCode: ev.code ?? null, activityParams: ev.params ?? null, model: ev.model ?? prev.model };
      if (ev.code) logMsg(`logs.code.${ev.code.toLowerCase().replace(/_/g, '-')}`, ev.params, ev.kind ?? 'activity', ev.text);
      else logItem(ev.text, ev.kind ?? 'activity');
      break;
    }
    case 'loop':
      next.loops = { ...run.loops, [ev.edge]: ev.count };
      logMsg('logs.event.loop', { edge: ev.edge, count: ev.count, max: ev.max });
      break;
    case 'cost':
      next.cost = ev.total;
      break;
    case 'run_end':
      next.status = ev.status ?? 'done';
      if (ev.cost !== undefined) next.cost = ev.cost;
      next.error = ev.error ?? null;
      next.errorCode = ev.errorCode ?? null;
      next.errorParams = ev.errorParams ?? null;
      next.endedAt = ev.ts ?? Date.now();
      logMsg(ev.error ? 'logs.event.run-end-error' : 'logs.event.run-end', { status: next.status, error: ev.error ?? '', errorCode: ev.errorCode ?? null, errorParams: ev.errorParams ?? null });
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

// The edge status: 'done' (green, the flow already passed through), 'active' (blue, leading to the running node), or null.
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

export function formatTokens(t, n) {
  let value = String(n || 0);
  if (n >= 1e6) value = `${(n / 1e6).toFixed(1)}M`;
  else if (n >= 1000) value = `${(n / 1000).toFixed(1)}k`;
  return t('common.tokens', { value });
}

export function formatDuration(t, ms) {
  if (ms === null || ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return t('common.duration-s', { s });
  return t('common.duration-ms', { m: Math.floor(s / 60), s: s % 60 });
}

export function formatTime(intl, ts) {
  return ts ? new Date(ts).toLocaleTimeString(intl, { hour12: false }) : '';
}
