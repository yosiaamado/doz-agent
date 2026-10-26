// One executor per node type. Each function takes `ctx` (WorkflowRun) and returns the node result.
import { resolveSettings } from './workflow.js';
import { buildNodePrompt, buildJudgePrompt, parseVerdict } from './prompt.js';
import { withTimeout } from './timeout.js';
import { runCommand } from '../runners/shell.js';
import { CodedError } from '../lib/errors.js';

function outputReport(ctx, node) {
  return ctx.upstreamOutputs(node, 'all').map((u) => `## ${u.node.label || u.node.id}\n\n${u.output}`).join('\n\n---\n\n');
}

function requireRunner(ctx, name) {
  const runner = ctx.runners[name];
  if (!runner) throw new CodedError(`Unknown runner "${name}"`, 'RUNNER_UNKNOWN', { runner: name });
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
  if (node.type === 'agent' && !agent) throw new CodedError(`Agent "${node.agent}" not found`, 'AGENT_NOT_FOUND', { agent: node.agent });
  const settings = resolveSettings(node, ctx.wf, agent);
  const runner = requireRunner(ctx, settings.runner);
  const prompt = buildNodePrompt({
    wf: ctx.wf, node, settings, input: ctx.input,
    upstream: ctx.upstreamOutputs(node, settings.inputs),
    infos: ctx.infoFor(node.id),
    feedback: ctx.feedback[node.id] ?? null,
  });
  const opts = { node, agent, settings, prompt, workdir: ctx.workdir, env: ctx.spawn?.cliEnv, shellEnv: ctx.spawn?.shellEnv, profileId: ctx.spawn?.profileId };
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
        ctx.emit({ type: 'activity', node: node.id, kind: 'retry', text: `Failed, retrying (${err.message})`, code: 'ACTIVITY_RETRY', params: { reason: err.message } });
      }
    }
  }
  throw lastErr ?? new Error('stopped');
}

export async function runAction(ctx, node, signal) {
  const preset = node.action ? ctx.actions[node.action] : null;
  if (node.action && !preset) throw new CodedError(`Action "${node.action}" not found`, 'ACTION_NOT_FOUND', { action: node.action });
  const command = node.command || preset?.command;
  if (!command) throw new CodedError('Action has no command', 'ACTION_NO_COMMAND');
  const timeout = Number(node.timeout_min ?? preset?.timeout_min) || 15;
  ctx.setNode(node.id, { command });
  ctx.emit({ type: 'activity', node: node.id, kind: 'tool', tool: 'Shell', text: `$ ${command}` });
  const res = await withTimeout(timeout, signal, (s) => runCommand({
    command, workdir: ctx.workdir, signal: s, env: ctx.spawn?.shellEnv ?? process.env,
    onLine: (line) => ctx.emit({ type: 'activity', node: node.id, kind: 'text', text: line }),
  }));
  return { output: `$ ${command}\n(exit ${res.code})\n\n${res.output}`, verdict: res.code === 0, exitCode: res.code };
}

function knownVerdict(ctx, node, sourceId) {
  const mode = node.mode ?? 'auto';
  if (mode === 'llm') return null;
  const known = ctx.state[sourceId]?.verdict;
  if (typeof known === 'boolean') return { verdict: known, output: `Result of ${sourceId}: ${known ? 'PASS' : 'FAIL'}`, reason: 'verdict' };
  const parsed = parseVerdict(ctx.state[sourceId]?.output ?? '');
  if (parsed !== null) return { verdict: parsed, output: `VERDICT from ${sourceId}: ${parsed ? 'PASS' : 'FAIL'}`, reason: 'verdict' };
  if (mode === 'verdict') throw new CodedError(`Output of ${sourceId} has no VERDICT line`, 'VERDICT_MISSING', { node: sourceId });
  return null;
}

export async function evaluateCondition(ctx, node, signal) {
  const sourceId = node.source ?? ctx.incomingOf(node.id)[0]?.from;
  const known = knownVerdict(ctx, node, sourceId);
  if (known) return known;
  const settings = resolveSettings({ ...node, model: node.model ?? 'haiku', max_turns: 1 }, ctx.wf, null);
  const runner = requireRunner(ctx, settings.runner);
  ctx.emit({ type: 'activity', node: node.id, kind: 'text', text: `Judging: ${node.check}`, code: 'ACTIVITY_JUDGING', params: { check: node.check } });
  const prompt = buildJudgePrompt({ question: node.check, subject: ctx.state[sourceId]?.output ?? '' });
  const res = await withTimeout(settings.timeout_min, signal, (s) => runner.judge({ prompt, settings, workdir: ctx.workdir, signal: s, env: ctx.spawn?.cliEnv, profileId: ctx.spawn?.profileId }));
  ctx.addCost(res.cost);
  const verdict = parseVerdict(res.output);
  if (verdict === null) throw new CodedError('The judge did not return a VERDICT', 'JUDGE_NO_VERDICT');
  return { verdict, output: res.output, cost: res.cost, reason: 'llm' };
}

export function waitApproval(ctx, node) {
  ctx.setNode(node.id, { status: 'waiting', activity: node.message || 'Waiting for approval', ...(node.message ? {} : { activityCode: 'ACTIVITY_WAITING_APPROVAL' }) });
  return new Promise((resolve) => {
    ctx.registerApproval(node.id, ({ approved, note }) => {
      resolve({ verdict: approved, output: `${approved ? 'Approved' : 'Rejected'}${note ? `: ${note}` : ''}` });
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
