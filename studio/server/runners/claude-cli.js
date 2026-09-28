// Runner lewat Claude Code CLI (`claude -p`), memakai login Claude Code atau ANTHROPIC_API_KEY di env.
// Agent dari plugins/agents dimuat langsung lewat --agents/--agent, jadi plugin tidak perlu ter-install di project.
import { spawn, spawnSync } from 'node:child_process';
import { describeTool } from './activity.js';

const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const READONLY_BASH = ['Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git status:*)', 'Bash(git show:*)', 'Bash(ls:*)'];

export function claudeAvailable() {
  try {
    const r = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 10_000 });
    return r.status === 0 ? r.stdout.trim() : null;
  } catch {
    return null;
  }
}

export function buildArgs({ node, agent, settings, prompt }) {
  const args = ['-p', node.type === 'skill' ? `/${node.skill} ${prompt}` : prompt, '--output-format', 'stream-json', '--verbose'];
  if (agent) {
    let tools = agent.tools.length ? agent.tools : ['Read', 'Grep', 'Glob', 'Bash'];
    if (settings.permission === 'read-only') tools = tools.filter((t) => !WRITE_TOOLS.has(t));
    args.push('--agents', JSON.stringify({ [agent.name]: { description: agent.description, prompt: agent.prompt, tools } }));
    args.push('--agent', agent.name);
    // Mode -p tidak bisa menanyakan izin, jadi tool agent diizinkan di depan.
    const allowed = settings.permission === 'read-only'
      ? tools.filter((t) => t !== 'Bash').concat(tools.includes('Bash') ? READONLY_BASH : [])
      : tools;
    args.push('--allowedTools', allowed.join(','));
  } else if (settings.permission === 'read-only') {
    args.push('--disallowedTools', [...WRITE_TOOLS].join(','));
  }
  if (settings.permission !== 'read-only') args.push('--permission-mode', 'acceptEdits');
  if (settings.model) args.push('--model', String(settings.model));
  if (settings.effort) args.push('--effort', String(settings.effort));
  if (settings.max_turns) args.push('--max-turns', String(settings.max_turns));
  if (settings.budget_usd) args.push('--max-budget-usd', String(settings.budget_usd));
  return args;
}

function runClaude(args, { workdir, signal, onActivity }) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: workdir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const onAbort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', onAbort);
    let buffer = '';
    let stderr = '';
    let result = null;
    let lastText = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) > -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let ev;
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'result' || (ev.total_cost_usd !== undefined && ev.usage)) { result = ev; continue; }
        if (ev.type === 'system' && ev.subtype === 'init') onActivity?.({ kind: 'init', text: `model ${ev.model}`, model: ev.model, session: ev.session_id });
        if (ev.type === 'assistant' && ev.message?.content && !ev.parent_tool_use_id) {
          for (const block of ev.message.content) {
            if (block.type === 'tool_use') onActivity?.({ kind: 'tool', tool: block.name, text: describeTool(block.name, block.input).replaceAll(`${workdir}/`, '') });
            if (block.type === 'text' && block.text.trim()) {
              lastText = block.text;
              onActivity?.({ kind: 'text', text: block.text.slice(0, 400) });
            }
          }
        }
        if (ev.type === 'user' && Array.isArray(ev.message?.content)) {
          for (const block of ev.message.content) {
            if (block.type === 'tool_result' && block.is_error) onActivity?.({ kind: 'tool_error', text: String(typeof block.content === 'string' ? block.content : JSON.stringify(block.content)).slice(0, 300) });
          }
        }
      }
    });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (err) => reject(new Error(`gagal menjalankan claude: ${err.message}`)));
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) return reject(new Error('dihentikan'));
      if (!result) return reject(new Error(stderr.trim().slice(-500) || `claude keluar dengan kode ${code}`));
      const maxTurns = result.subtype === 'error_max_turns';
      if (result.is_error && !maxTurns) return reject(new Error(String(result.result ?? result.subtype ?? 'error').slice(0, 500)));
      resolve({
        output: result.result ?? lastText,
        cost: result.total_cost_usd ?? 0,
        usage: result.usage ? {
          input: result.usage.input_tokens ?? 0,
          output: result.usage.output_tokens ?? 0,
          cacheRead: result.usage.cache_read_input_tokens ?? 0,
          cacheWrite: result.usage.cache_creation_input_tokens ?? 0,
        } : null,
        turns: result.num_turns,
        warning: maxTurns ? 'berhenti di max_turns, hasil bisa belum lengkap' : undefined,
      });
    });
  });
}

export const claudeCliRunner = {
  name: 'claude-cli',
  run(opts) {
    return runClaude(buildArgs(opts), opts);
  },
  judge({ prompt, settings, workdir, signal }) {
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--max-turns', '1', '--tools', ''];
    if (settings.model) args.push('--model', String(settings.model));
    return runClaude(args, { workdir, signal });
  },
};
