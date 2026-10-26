// A runner that goes through the Claude Code CLI (`claude -p`), using the Claude Code login or ANTHROPIC_API_KEY from the env.
// The prompt is sent over stdin and the agent definitions through a temporary file, so the CLI arguments stay short
// and safe to quote (on Windows too, where `claude` is usually claude.cmd).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { reduceStreamEvent, toRunResult, emptyStreamState } from './stream.js';

export { reduceStreamEvent, toRunResult };

const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch']);
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
  if (!agent) return readOnly ? ['--disallowedTools', [...WRITE_TOOLS, 'Bash'].join(',')] : ['--permission-mode', 'acceptEdits'];
  const tools = agentTools(agent, settings.permission);
  // In -p mode there is no way to ask for permission, so the agent's tools are allowed up front.
  // Read-only gets no Bash: even `git log --output=<file>` can write a file.
  const allowed = readOnly ? tools.filter((t) => t !== 'Bash') : tools;
  return ['--allowedTools', allowed.join(','), ...(readOnly ? [] : ['--permission-mode', 'acceptEdits'])];
}

export function agentDefinition(agent, permission) {
  return { [agent.name]: { description: agent.description, prompt: agent.prompt, tools: agentTools(agent, permission) } };
}

// The CLI arguments without the prompt (the prompt goes over stdin). `agentsFile` = the path of the agent definition JSON.
export function buildArgs({ agent, settings }, { pluginDir, agentsFile } = {}) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose'];
  if (agent) args.push('--agents', agentsFile ?? '<agents.json>', '--agent', agent.name);
  args.push(...permissionArgs(agent, settings));
  if (settings.model) args.push('--model', String(settings.model));
  if (settings.effort) args.push('--effort', String(settings.effort));
  if (settings.max_turns) args.push('--max-turns', String(settings.max_turns));
  if (settings.budget_usd) args.push('--max-budget-usd', String(settings.budget_usd));
// The doz-agent:* skills are available even when the plugin is not installed in the project.
  if (pluginDir && settings.load_plugin !== false) args.push('--plugin-dir', pluginDir);
  return args;
}

const SUBAGENT_NAMES = new Set(['Task', 'Agent']);

// Chats never get Bash or web tools (Read plus WebFetch could send files out): allow-edits means the file edit tools only.
function chatTools(agent, allowEdits) {
  const tools = agent.tools.length ? agent.tools : ['Read', 'Grep', 'Glob'];
  return tools.filter((t) => !SUBAGENT_NAMES.has(t) && t !== 'Bash' && !WEB_TOOLS.has(t) && (allowEdits || !WRITE_TOOLS.has(t)));
}

export function chatAgentDefinition(agent, allowEdits = false) {
  return { [agent.name]: { description: agent.description, prompt: agent.prompt, tools: chatTools(agent, allowEdits) } };
}

// A first turn passes a fresh --session-id; later turns resume the stored one. The permission mode is always explicit and
// only the user settings are loaded, so a cloned repo's .claude/settings.json cannot widen what the chat may do.
export function buildChatArgs({ agent, sessionId, resume, allowEdits }, { pluginDir, agentsFile } = {}) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--agents', agentsFile ?? '<agents.json>', '--agent', agent.name];
  args.push(...(resume && sessionId ? ['--resume', sessionId] : ['--session-id', crypto.randomUUID()]));
  const denied = ['Task', 'Agent', 'Bash', ...WEB_TOOLS, ...(allowEdits ? [] : [...WRITE_TOOLS])];
  args.push('--disallowedTools', denied.join(','), '--allowedTools', chatTools(agent, allowEdits).join(','));
  args.push('--permission-mode', allowEdits ? 'acceptEdits' : 'dontAsk', '--setting-sources', 'user', '--strict-mcp-config');
  if (pluginDir) args.push('--plugin-dir', pluginDir);
  return args;
}

export function stdinPrompt({ node, prompt }) {
  return node.type === 'skill' ? `/${node.skill} ${prompt}` : prompt;
}

function shellQuote(s) {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;
}

// A command that can be pasted into a terminal (prompt.md = the contents of the Input tab, agents.json = the agent definitions).
export function describeCommand(opts, { pluginDir } = {}) {
  const args = buildArgs(opts, { pluginDir, agentsFile: 'agents.json' });
  const agentNote = opts.agent ? `   # agents.json = {"${opts.agent.name}": the contents of ${opts.agent.file ?? 'the agent file'}}` : '';
  return `claude ${args.map(shellQuote).join(' ')} < prompt.md${agentNote}`;
}

// cmd.exe expands %VAR% even inside double quotes and there is no way to escape it on a command line.
function winQuote(arg) {
  if (String(arg).includes('%')) throw new Error(`argument contains "%", which cmd.exe would expand: ${String(arg).slice(0, 80)}`);
  return /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `"${String(arg).replace(/"/g, '""')}"`;
}

function spawnClaude(bin, args, workdir, env = process.env) {
  if (!IS_WINDOWS) return spawn(bin, args, { cwd: workdir, env, stdio: ['pipe', 'pipe', 'pipe'] });
  return spawn([bin, ...args].map(winQuote).join(' '), { cwd: workdir, env, stdio: ['pipe', 'pipe', 'pipe'], shell: true });
}

function runClaude({ bin, args, input, workdir, env, signal, callbacks, cleanup }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnClaude(bin, args, workdir, env);
    } catch (err) {
      cleanup?.();
      reject(err);
      return;
    }
    const onAbort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', onAbort);
    let buffer = '';
    let stderr = '';
    let state = emptyStreamState();
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
    chat({ agent, text, sessionId, resume, allowEdits, workdir, env, profileId, signal, onActivity, onUsage }) {
      const agentsFile = path.join(os.tmpdir(), `doz-agents-${crypto.randomBytes(6).toString('hex')}.json`);
      fs.writeFileSync(agentsFile, JSON.stringify(chatAgentDefinition(agent, allowEdits)));
      return runClaude({
        bin,
        args: buildChatArgs({ agent, sessionId, resume, allowEdits }, { pluginDir, agentsFile }),
        input: text,
        workdir,
        env: env ?? process.env,
        signal,
        callbacks: { onActivity, onUsage, onRateLimit: (info) => onRateLimit?.(info, profileId) },
        cleanup: () => fs.rmSync(agentsFile, { force: true }),
      });
    },
    run(opts) {
      const agentsFile = opts.agent ? writeAgentsFile(opts.agent, opts.settings.permission) : null;
      return runClaude({
        bin,
        args: buildArgs(opts, { pluginDir, agentsFile }),
        input: stdinPrompt(opts),
        workdir: opts.workdir,
        env: opts.env ?? process.env,
        signal: opts.signal,
        callbacks: { onActivity: opts.onActivity, onUsage: opts.onUsage, onRateLimit: (info) => onRateLimit?.(info, opts.profileId) },
        cleanup: () => agentsFile && fs.rmSync(agentsFile, { force: true }),
      });
    },
    judge({ prompt, settings, workdir, signal, env, profileId }) {
      const args = ['-p', '--output-format', 'stream-json', '--verbose', '--max-turns', '1', '--tools', ''];
      if (settings.model) args.push('--model', String(settings.model));
      return runClaude({ bin, args, input: prompt, workdir, env: env ?? process.env, signal, callbacks: { onRateLimit: (info) => onRateLimit?.(info, profileId) } });
    },
  };
}
