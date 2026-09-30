// Runner lewat Claude Code CLI (`claude -p`), memakai login Claude Code atau ANTHROPIC_API_KEY di env.
// Prompt dikirim lewat stdin dan definisi agent lewat file sementara, jadi argumen CLI selalu pendek
// dan aman di-quote (juga di Windows, tempat `claude` biasanya berupa claude.cmd).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describeTool, touchedFile } from './activity.js';

const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const READONLY_BASH = ['Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git status:*)', 'Bash(git show:*)', 'Bash(ls:*)'];
const IS_WINDOWS = process.platform === 'win32';

export function claudeVersion(bin = 'claude') {
  try {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 10_000, shell: IS_WINDOWS });
    return r.status === 0 ? r.stdout.trim() : null;
  } catch {
    return null;
  }
}

function agentTools(agent, permission) {
  const tools = agent.tools.length ? agent.tools : ['Read', 'Grep', 'Glob', 'Bash'];
  return permission === 'read-only' ? tools.filter((t) => !WRITE_TOOLS.has(t)) : tools;
}

function permissionArgs(agent, settings) {
  const readOnly = settings.permission === 'read-only';
  if (!agent) return readOnly ? ['--disallowedTools', [...WRITE_TOOLS].join(',')] : ['--permission-mode', 'acceptEdits'];
  const tools = agentTools(agent, settings.permission);
  // Mode -p tidak bisa menanyakan izin, jadi tool agent diizinkan di depan.
  const allowed = readOnly ? tools.filter((t) => t !== 'Bash').concat(tools.includes('Bash') ? READONLY_BASH : []) : tools;
  return ['--allowedTools', allowed.join(','), ...(readOnly ? [] : ['--permission-mode', 'acceptEdits'])];
}

export function agentDefinition(agent, permission) {
  return { [agent.name]: { description: agent.description, prompt: agent.prompt, tools: agentTools(agent, permission) } };
}

// Argumen CLI tanpa prompt (prompt lewat stdin). `agentsFile` = path JSON definisi agent.
export function buildArgs({ agent, settings }, { pluginDir, agentsFile } = {}) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose'];
  if (agent) args.push('--agents', agentsFile ?? '<agents.json>', '--agent', agent.name);
  args.push(...permissionArgs(agent, settings));
  if (settings.model) args.push('--model', String(settings.model));
  if (settings.effort) args.push('--effort', String(settings.effort));
  if (settings.max_turns) args.push('--max-turns', String(settings.max_turns));
  if (settings.budget_usd) args.push('--max-budget-usd', String(settings.budget_usd));
  // Skill doz-agent:* tersedia walau plugin belum ter-install di project.
  if (pluginDir && settings.load_plugin !== false) args.push('--plugin-dir', pluginDir);
  return args;
}

export function stdinPrompt({ node, prompt }) {
  return node.type === 'skill' ? `/${node.skill} ${prompt}` : prompt;
}

function shellQuote(s) {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// Perintah yang bisa disalin ke terminal (prompt.md = isi tab Input, agents.json = definisi agent).
export function describeCommand(opts, { pluginDir } = {}) {
  const args = buildArgs(opts, { pluginDir, agentsFile: 'agents.json' });
  const agentNote = opts.agent ? `   # agents.json = {"${opts.agent.name}": isi ${opts.agent.file ?? 'file agent'}}` : '';
  return `claude ${args.map(shellQuote).join(' ')} < prompt.md${agentNote}`;
}

function winQuote(arg) {
  return /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `"${String(arg).replace(/"/g, '""')}"`;
}

function spawnClaude(bin, args, workdir) {
  if (!IS_WINDOWS) return spawn(bin, args, { cwd: workdir, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  return spawn([bin, ...args].map(winQuote).join(' '), { cwd: workdir, env: process.env, stdio: ['pipe', 'pipe', 'pipe'], shell: true });
}

function toUsage(u) {
  return {
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
}

function sumUsage(list) {
  return list.reduce((acc, u) => ({
    input: acc.input + u.input, output: acc.output + u.output, cacheRead: acc.cacheRead + u.cacheRead, cacheWrite: acc.cacheWrite + u.cacheWrite,
  }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
}

// Membaca satu event stream-json dan meneruskannya ke callback. Mengembalikan state baru.
export function reduceStreamEvent(state, ev, { workdir, onActivity, onUsage, onRateLimit }) {
  if (ev.type === 'result' || (ev.total_cost_usd !== undefined && ev.usage)) return { ...state, result: ev };
  if (ev.type === 'rate_limit_event' && ev.rate_limit_info) onRateLimit?.(ev.rate_limit_info);
  if (ev.type === 'system' && ev.subtype === 'init') onActivity?.({ kind: 'init', text: `model ${ev.model}`, model: ev.model, session: ev.session_id });
  if (ev.type === 'user' && Array.isArray(ev.message?.content)) {
    ev.message.content.filter((b) => b.type === 'tool_result' && b.is_error).forEach((b) => onActivity?.({
      kind: 'tool_error', text: String(typeof b.content === 'string' ? b.content : JSON.stringify(b.content)).slice(0, 300),
    }));
  }
  if (ev.type !== 'assistant' || !ev.message) return state;
  let next = state;
  if (ev.message.usage && ev.message.id) {
    const usageById = { ...state.usageById, [ev.message.id]: toUsage(ev.message.usage) };
    next = { ...next, usageById };
    onUsage?.(sumUsage(Object.values(usageById)));
  }
  if (ev.parent_tool_use_id) return next;
  for (const block of ev.message.content ?? []) {
    if (block.type === 'tool_use') {
      onActivity?.({
        kind: 'tool', tool: block.name,
        text: describeTool(block.name, block.input).replaceAll(`${workdir}/`, ''),
        file: touchedFile(block.name, block.input, workdir),
      });
    }
    if (block.type === 'text' && block.text.trim()) {
      next = { ...next, lastText: block.text };
      onActivity?.({ kind: 'text', text: block.text.slice(0, 400) });
    }
  }
  return next;
}

export function toRunResult(state) {
  const result = state.result;
  const maxTurns = result.subtype === 'error_max_turns';
  if (result.is_error && !maxTurns) throw new Error(String(result.result ?? result.subtype ?? 'error').slice(0, 500));
  return {
    output: result.result ?? state.lastText,
    cost: result.total_cost_usd ?? 0,
    usage: result.usage ? toUsage(result.usage) : null,
    turns: result.num_turns,
    warning: maxTurns ? 'stopped at max_turns, the result may be incomplete' : undefined,
    warningCode: maxTurns ? 'MAX_TURNS_REACHED' : undefined,
  };
}

function runClaude({ bin, args, input, workdir, signal, callbacks, cleanup }) {
  return new Promise((resolve, reject) => {
    const child = spawnClaude(bin, args, workdir);
    const onAbort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', onAbort);
    let buffer = '';
    let stderr = '';
    let state = { result: null, lastText: '', usageById: {} };
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        state = reduceStreamEvent(state, ev, { workdir, ...callbacks });
      }
    });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (err) => reject(new Error(`failed to run claude: ${err.message}`)));
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      cleanup?.();
      if (signal?.aborted) return reject(new Error('stopped'));
      if (!state.result) return reject(new Error(stderr.trim().slice(-500) || `claude exited with code ${code}`));
      try {
        resolve(toRunResult(state));
      } catch (err) {
        reject(err);
      }
    });
    child.stdin.end(input);
  });
}

function writeAgentsFile(agent, permission) {
  const file = path.join(os.tmpdir(), `doz-agents-${crypto.randomBytes(6).toString('hex')}.json`);
  fs.writeFileSync(file, JSON.stringify(agentDefinition(agent, permission)));
  return file;
}

export function createClaudeCliRunner({ pluginDir, onRateLimit, bin = 'claude' } = {}) {
  return {
    name: 'claude-cli',
    describe: (opts) => describeCommand(opts, { pluginDir }),
    run(opts) {
      const agentsFile = opts.agent ? writeAgentsFile(opts.agent, opts.settings.permission) : null;
      return runClaude({
        bin,
        args: buildArgs(opts, { pluginDir, agentsFile }),
        input: stdinPrompt(opts),
        workdir: opts.workdir,
        signal: opts.signal,
        callbacks: { onActivity: opts.onActivity, onUsage: opts.onUsage, onRateLimit },
        cleanup: () => agentsFile && fs.rmSync(agentsFile, { force: true }),
      });
    },
    judge({ prompt, settings, workdir, signal }) {
      const args = ['-p', '--output-format', 'stream-json', '--verbose', '--max-turns', '1', '--tools', ''];
      if (settings.model) args.push('--model', String(settings.model));
      return runClaude({ bin, args, input: prompt, workdir, signal, callbacks: { onRateLimit } });
    },
  };
}
