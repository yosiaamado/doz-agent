// Eksekutor per tipe node. Setiap fungsi menerima `ctx` (WorkflowRun) dan mengembalikan hasil node.
import { resolveSettings } from './workflow.js';
import { buildNodePrompt, buildJudgePrompt, parseVerdict } from './prompt.js';
import { withTimeout } from './timeout.js';
import { runCommand } from '../runners/shell.js';

function outputReport(ctx, node) {
  return ctx.upstreamOutputs(node, 'all').map((u) => `## ${u.node.label || u.node.id}\n\n${u.output}`).join('\n\n---\n\n');
}

function requireRunner(ctx, name) {
  const runner = ctx.runners[name];
  if (!runner) throw new Error(`Runner "${name}" tidak dikenal`);
  return runner;
}

async function attemptAgent(ctx, node, runner, opts, signal) {
  const res = await withTimeout(opts.settings.timeout_min, signal, (attemptSignal) => runner.run({
    ...opts,
    signal: attemptSignal,
    onActivity: (activity) => ctx.recordActivity(node.id, activity),
    onUsage: (usage) => ctx.emit({ type: 'node', node: node.id, usage }),
  }));
  ctx.addCost(res.cost);
  return { ...res, verdict: node.verdict ? parseVerdict(res.output) : undefined };
}

export async function runAgent(ctx, node, signal) {
  const agent = node.type === 'agent' ? ctx.agents[node.agent] : null;
  if (node.type === 'agent' && !agent) throw new Error(`Agent "${node.agent}" tidak ditemukan`);
  const settings = resolveSettings(node, ctx.wf, agent);
  const runner = requireRunner(ctx, settings.runner);
  const prompt = buildNodePrompt({
    wf: ctx.wf, node, settings, input: ctx.input,
    upstream: ctx.upstreamOutputs(node, settings.inputs),
    infos: ctx.infoFor(node.id),
    feedback: ctx.feedback[node.id] ?? null,
  });
  const opts = { node, agent, settings, prompt, workdir: ctx.workdir };
  const command = runner.describe?.(opts);
  const attempts = Math.max(0, Number(settings.retry) || 0) + 1;
  let lastErr = null;
  for (let attempt = 1; attempt <= attempts && !signal.aborted; attempt++) {
    ctx.setNode(node.id, { attempts: attempt, settings, prompt, command });
    try {
      return await attemptAgent(ctx, node, runner, opts, signal);
    } catch (err) {
      lastErr = err;
      if (!signal.aborted && attempt < attempts) {
        ctx.emit({ type: 'activity', node: node.id, kind: 'retry', text: `Gagal, coba lagi (${err.message})` });
      }
    }
  }
  throw lastErr ?? new Error('dihentikan');
}

export async function runAction(ctx, node, signal) {
  const preset = node.action ? ctx.actions[node.action] : null;
  if (node.action && !preset) throw new Error(`Action "${node.action}" tidak ditemukan`);
  const command = node.command || preset?.command;
  if (!command) throw new Error('Action tanpa perintah');
  const timeout = Number(node.timeout_min ?? preset?.timeout_min) || 15;
  ctx.setNode(node.id, { command });
  ctx.emit({ type: 'activity', node: node.id, kind: 'tool', tool: 'Shell', text: `$ ${command}` });
  const res = await withTimeout(timeout, signal, (s) => runCommand({
    command, workdir: ctx.workdir, signal: s,
    onLine: (line) => ctx.emit({ type: 'activity', node: node.id, kind: 'text', text: line }),
  }));
  return { output: `$ ${command}\n(exit ${res.code})\n\n${res.output}`, verdict: res.code === 0, exitCode: res.code };
}

function knownVerdict(ctx, node, sourceId) {
  const mode = node.mode ?? 'auto';
  if (mode === 'llm') return null;
  const known = ctx.state[sourceId]?.verdict;
  if (typeof known === 'boolean') return { verdict: known, output: `Hasil ${sourceId}: ${known ? 'PASS' : 'FAIL'}`, reason: 'verdict' };
  const parsed = parseVerdict(ctx.state[sourceId]?.output ?? '');
  if (parsed !== null) return { verdict: parsed, output: `VERDICT dari ${sourceId}: ${parsed ? 'PASS' : 'FAIL'}`, reason: 'verdict' };
  if (mode === 'verdict') throw new Error(`Output ${sourceId} tidak punya baris VERDICT`);
  return null;
}

export async function evaluateCondition(ctx, node, signal) {
  const sourceId = node.source ?? ctx.incomingOf(node.id)[0]?.from;
  const known = knownVerdict(ctx, node, sourceId);
  if (known) return known;
  const settings = resolveSettings({ ...node, model: node.model ?? 'haiku', max_turns: 1 }, ctx.wf, null);
  const runner = requireRunner(ctx, settings.runner);
  ctx.emit({ type: 'activity', node: node.id, kind: 'text', text: `Menilai: ${node.check}` });
  const prompt = buildJudgePrompt({ question: node.check, subject: ctx.state[sourceId]?.output ?? '' });
  const res = await withTimeout(settings.timeout_min, signal, (s) => runner.judge({ prompt, settings, workdir: ctx.workdir, signal: s }));
  ctx.addCost(res.cost);
  const verdict = parseVerdict(res.output);
  if (verdict === null) throw new Error('Penilai tidak mengembalikan VERDICT');
  return { verdict, output: res.output, cost: res.cost, reason: 'llm' };
}

export function waitApproval(ctx, node) {
  ctx.setNode(node.id, { status: 'waiting', activity: node.message || 'Menunggu persetujuan' });
  return new Promise((resolve) => {
    ctx.registerApproval(node.id, ({ approved, note }) => {
      resolve({ verdict: approved, output: `${approved ? 'Disetujui' : 'Ditolak'}${note ? `: ${note}` : ''}` });
    });
  });
}

export const EXECUTORS = Object.freeze({
  start: async (ctx, node) => ({ output: ctx.input || node.input || '' }),
  info: async (ctx, node) => ({ output: node.text ?? '' }),
  output: async (ctx, node) => ({ output: outputReport(ctx, node) }),
  condition: evaluateCondition,
  approval: waitApproval,
  action: runAction,
  agent: runAgent,
  skill: runAgent,
});
