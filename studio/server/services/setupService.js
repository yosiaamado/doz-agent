// The Setup wizard: checks every requirement before the studio is used, and runs the live tests.
// Cheap checks (no cost) live in `check()`, the tests that call out to a service in `test(name)`.
import { execFile, spawn } from 'node:child_process';
import { ApiError, badRequest } from '../lib/errors.js';
import { redactText } from './gitService.js';
import { setInjectedApiKey, childEnv } from '../lib/secretEnv.js';

const IS_WINDOWS = process.platform === 'win32';
const MIN_NODE_MAJOR = 20;
const LOGIN_URL_WAIT_MS = 8000;

function run(bin, args, { cwd, timeout = 30_000, input } = {}) {
  return new Promise((resolve) => {
    const child = execFile(bin, args, {
      cwd, timeout, shell: IS_WINDOWS, env: bin === 'claude' ? { ...process.env, GIT_TERMINAL_PROMPT: '0' } : childEnv({ GIT_TERMINAL_PROMPT: '0' }), maxBuffer: 4 * 1024 * 1024,
    }, (err, stdout, stderr) => resolve({ ok: !err, code: err?.code ?? 0, out: redactText(`${stdout}`.trim()), err: redactText(`${stderr}`.trim() || err?.message || '') }));
    if (input !== undefined) child.stdin?.end(input);
  });
}

const result = (status, detail, extra = {}) => ({ status, detail, ...extra });

// Errors from the SDK/CLI are turned into messages the user can act on.
export function friendlyError(err) {
  if (err instanceof ApiError) return err;
  const status = err?.status;
  if (status === 401) return badRequest('API key rejected (401). Check or recreate the key at console.anthropic.com → API Keys.', { code: 'API_KEY_REJECTED' });
  if (status === 403) return badRequest('Access denied (403). This key has no permission for the tested model.', { code: 'API_KEY_FORBIDDEN' });
  if (status === 429) return badRequest('Rate limit or quota exhausted (429). Try again later or check billing.', { code: 'API_RATE_LIMITED' });
  if (status >= 500) return badRequest(`The Anthropic service is having problems (${status}). Try again shortly.`, { code: 'API_SERVICE_DOWN', params: { status } });
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|Connection error/i.test(err?.message ?? '')) return badRequest('Cannot connect to api.anthropic.com. Check your internet connection / proxy.', { code: 'API_UNREACHABLE' });
  return badRequest(err?.message ?? 'Test failed');
}

async function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  return major >= MIN_NODE_MAJOR
    ? result('ok', `Node ${process.versions.node}`)
    : result('error', `Node ${process.versions.node}; needs ${MIN_NODE_MAJOR}+`, { code: 'NODE_TOO_OLD', params: { version: process.versions.node, min: MIN_NODE_MAJOR }, fix: 'Install the latest Node.js LTS from nodejs.org', fixCode: 'FIX_INSTALL_NODE' });
}

async function checkClaudeInstalled() {
  const r = await run('claude', ['--version'], { timeout: 15_000 });
  return r.ok
    ? result('ok', r.out)
    : result('error', 'The `claude` command was not found', { code: 'CLAUDE_MISSING', fix: 'npm install -g @anthropic-ai/claude-code   (or the official Claude Code installer)', fixCode: 'FIX_INSTALL_CLAUDE' });
}

async function checkClaudeAuth() {
  const r = await run('claude', ['auth', 'status'], { timeout: 20_000 });
  if (!r.ok) return result('error', 'Not logged in to Claude Code', { code: 'CLAUDE_NOT_LOGGED_IN', fix: 'claude auth login' });
  try {
    const s = JSON.parse(r.out);
    if (!s.loggedIn) return result('error', 'Not logged in to Claude Code', { code: 'CLAUDE_NOT_LOGGED_IN', fix: 'claude auth login' });
    const account = `${s.authMethod ?? 'account'}${s.apiProvider && s.apiProvider !== 'firstParty' ? `, ${s.apiProvider}` : ''}`;
    return result('ok', `Logged in (${account})`, { code: 'CLAUDE_LOGGED_IN', params: { account } });
  } catch {
    return result('warn', r.out.slice(0, 200));
  }
}

async function checkPlugin() {
  const r = await run('claude', ['plugin', 'list', '--json'], { timeout: 20_000 });
  if (!r.ok) return result('warn', 'Cannot read the plugin list', { code: 'PLUGIN_LIST_UNREADABLE' });
  const installed = (() => { try { return JSON.parse(r.out); } catch { return []; } })();
  const found = installed.some((p) => String(p.name ?? p.id ?? p).includes('doz-agent'));
  return found
    ? result('ok', 'The doz-agent plugin is installed in Claude Code', { code: 'PLUGIN_INSTALLED' })
    : result('warn', 'The doz-agent plugin is not installed. Studio still works (it uses --plugin-dir), but /doz-agent:run-workflow in the terminal needs this plugin.', {
      code: 'PLUGIN_NOT_INSTALLED',
      fix: '/plugin marketplace add yosiaamado/doz-agent   then   /plugin install doz-agent@doz-agent   (inside Claude Code)',
      fixCode: 'FIX_INSTALL_PLUGIN',
    });
}

async function checkGit(cwd) {
  const version = await run('git', ['--version']);
  if (!version.ok) return result('error', 'git was not found', { code: 'GIT_MISSING', fix: 'Install git from git-scm.com', fixCode: 'FIX_INSTALL_GIT' });
  const [name, email] = await Promise.all([run('git', ['config', 'user.name'], { cwd }), run('git', ['config', 'user.email'], { cwd })]);
  if (!name.out || !email.out) return result('warn', `${version.out}; user.name/user.email are not set (commits will fail)`, { code: 'GIT_IDENTITY_MISSING', params: { version: version.out }, action: 'git-identity' });
  return result('ok', `${version.out} · ${name.out} <${email.out}>`, { name: name.out, email: email.out });
}

// An installation without a parent repo (the packaged app): this check does not apply, and is not a failure.
const skippedRepo = () => result('skipped', 'No doz-agent repository in this installation', { code: 'REPO_SKIPPED', ok: null, skipped: true });

// target: 'repo' | 'workdir' — the UI maps this to a translatable name; `label` is only the English fallback.
async function checkRepo(cwd, label, target) {
  const inside = await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  if (!inside.ok) return result('warn', `${label} is not a git repository (per-node diff and GitHub sync are unavailable)`, { code: 'REPO_NOT_GIT', params: { target }, fix: 'git init && git remote add origin <url-github>' });
  const remote = await run('git', ['remote', 'get-url', 'origin'], { cwd });
  if (!remote.ok) return result('warn', `${label} has no origin remote`, { code: 'REPO_NO_ORIGIN', params: { target }, fix: 'git remote add origin https://github.com/<user>/<repo>.git' });
  return result('ok', `${label}: ${redactText(remote.out)}`, { code: 'REPO_OK', params: { target, remote: redactText(remote.out) } });
}

export function createSetupService({ config, apiRunner, claudeRunner }) {
  const checks = async () => {
    const workdir = config.getWorkdir();
    const [node, claude, claudeAuth, plugin, git, repo, project] = await Promise.all([
      checkNode(), checkClaudeInstalled(), checkClaudeAuth(), checkPlugin(), checkGit(workdir),
      config.repoRoot ? checkRepo(config.repoRoot, 'doz-agent repo', 'repo') : skippedRepo(), checkRepo(workdir, 'Active project', 'workdir'),
    ]);
    const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    const apiKey = hasKey
      ? result('ok', `API key is set${config.savedApiKey() ? ' (saved in studio)' : ' (from the environment)'}`, { code: 'API_KEY_SET', params: { source: config.savedApiKey() ? 'studio' : 'environment' } })
      : config.apiKeyState() === 'unreadable'
        ? result('warn', 'The saved API key cannot be opened in this session. Enter it again.', { code: 'API_KEY_UNREADABLE', action: 'api-key' })
        : result('warn', 'No API key yet. Optional if you use the claude-cli runner.', { code: 'API_KEY_MISSING_OPTIONAL', action: 'api-key' });
    return { node, claude, claudeAuth, plugin, apiKey, git, repo, project, workdir, state: config.setupState() };
  };

  const tests = {
    // Actually runs `claude -p` with haiku, 1 turn.
    'claude-cli': async () => {
      const started = Date.now();
      const res = await claudeRunner.judge({ prompt: 'Reply with one word: ok', settings: { model: 'haiku' }, workdir: config.getWorkdir(), signal: AbortSignal.timeout(90_000) });
      return result('ok', `claude -p replied "${res.output.trim().slice(0, 40)}" in ${Date.now() - started} ms`, { code: 'TEST_CLI_OK', params: { reply: res.output.trim().slice(0, 40), ms: Date.now() - started }, cost: res.cost });
    },
    api: async () => {
      if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) throw badRequest('Enter an API key first', { code: 'API_KEY_REQUIRED' });
      const res = await apiRunner.testApiConnection();
      return result('ok', `${res.model} replied "${res.reply}" in ${res.ms} ms`, { code: 'TEST_API_OK', params: { model: res.model, reply: String(res.reply).slice(0, 80), ms: res.ms } });
    },
    // Reads the remote without changing anything: proves the GitHub credentials work.
    github: async (target = 'repo') => {
      const cwd = target === 'workdir' ? config.getWorkdir() : config.repoRoot;
      if (!cwd) throw badRequest('Repository is not available in this installation', { code: 'REPO_UNAVAILABLE' });
      const r = await run('git', ['ls-remote', '--heads', 'origin'], { cwd, timeout: 45_000 });
      if (!r.ok) throw badRequest(`Cannot reach GitHub: ${r.err.split('\n').slice(-3).join(' ')}`, { code: 'GITHUB_UNREACHABLE', params: { reason: r.err.split('\n').slice(-3).join(' ').slice(0, 300) } });
      return result('ok', `Connected to origin (${r.out.split('\n').filter(Boolean).length} branches readable)`, { code: 'TEST_GITHUB_OK', params: { branches: r.out.split('\n').filter(Boolean).length } });
    },
  };

  return {
    check: checks,
    async test(name, target) {
      const fn = tests[name];
      if (!fn) throw badRequest(`Unknown test: ${name}`, { code: 'SETUP_TEST_UNKNOWN', params: { name: String(name).slice(0, 50) } });
      try {
        const res = await fn(target);
        config.saveSetupState({ [`${name}${target ? `:${target}` : ''}`]: { ok: true, at: Date.now() } });
        return res;
      } catch (err) {
        config.saveSetupState({ [`${name}${target ? `:${target}` : ''}`]: { ok: false, at: Date.now() } });
        throw friendlyError(err);
      }
    },
    setApiKey({ key, remember }) {
      process.env.ANTHROPIC_API_KEY = key;
      setInjectedApiKey(key);
      apiRunner.resetClient();
      config.saveApiKey(remember ? key : null);
      return { saved: remember, masked: `${key.slice(0, 7)}…${key.slice(-4)}` };
    },
    clearApiKey() {
      delete process.env.ANTHROPIC_API_KEY;
      setInjectedApiKey(null);
      apiRunner.resetClient();
      config.saveApiKey(null);
      return { cleared: true };
    },
    async setGitIdentity({ name, email }) {
      const a = await run('git', ['config', '--global', 'user.name', name]);
      const b = await run('git', ['config', '--global', 'user.email', email]);
      if (!a.ok || !b.ok) throw badRequest(a.err || b.err);
      return checkGit(config.getWorkdir());
    },
    // `claude auth login` opens a browser on this computer. The login URL is returned in case the browser does not open on its own.
    startClaudeLogin({ console: useConsole } = {}) {
      return new Promise((resolve) => {
        const child = spawn('claude', ['auth', 'login', ...(useConsole ? ['--console'] : [])], { shell: IS_WINDOWS, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        const done = () => resolve({ started: true, url: /https:\/\/\S+/.exec(output)?.[0] ?? null, output: output.trim().slice(-600) });
        const collect = (c) => {
          output += c;
          if (/https:\/\/\S+/.test(output)) done();
        };
        child.stdout.on('data', collect);
        child.stderr.on('data', collect);
        child.on('error', (err) => resolve({ started: false, url: null, output: err.message }));
        child.on('close', done);
        setTimeout(done, LOGIN_URL_WAIT_MS);
        setTimeout(() => child.kill(), 5 * 60_000).unref();
      });
    },
    complete() {
      config.saveSetupState({ completedAt: Date.now() });
      return config.setupState();
    },
  };
}
