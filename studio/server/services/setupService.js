// Wizard Persiapan: memeriksa semua syarat sebelum studio dipakai dan menjalankan tes nyata.
// Pemeriksaan cepat (tanpa biaya) di `check()`, tes yang memanggil layanan di `test(name)`.
import { execFile, spawn } from 'node:child_process';
import { ApiError, badRequest } from '../lib/errors.js';
import { redactText } from './gitService.js';

const IS_WINDOWS = process.platform === 'win32';
const MIN_NODE_MAJOR = 20;
const LOGIN_URL_WAIT_MS = 8000;

function run(bin, args, { cwd, timeout = 30_000, input } = {}) {
  return new Promise((resolve) => {
    const child = execFile(bin, args, {
      cwd, timeout, shell: IS_WINDOWS, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 4 * 1024 * 1024,
    }, (err, stdout, stderr) => resolve({ ok: !err, code: err?.code ?? 0, out: redactText(`${stdout}`.trim()), err: redactText(`${stderr}`.trim() || err?.message || '') }));
    if (input !== undefined) child.stdin?.end(input);
  });
}

const result = (status, detail, extra = {}) => ({ status, detail, ...extra });

// Error dari SDK/CLI diterjemahkan jadi pesan yang bisa ditindaklanjuti user.
export function friendlyError(err) {
  if (err instanceof ApiError) return err;
  const status = err?.status;
  if (status === 401) return badRequest('API key ditolak (401). Cek atau buat ulang key di console.anthropic.com → API Keys.');
  if (status === 403) return badRequest('Akses ditolak (403). Key ini tidak punya izin untuk model yang dites.');
  if (status === 429) return badRequest('Kena rate limit / kuota habis (429). Coba lagi nanti atau cek billing.');
  if (status >= 500) return badRequest(`Layanan Anthropic sedang bermasalah (${status}). Coba lagi sebentar lagi.`);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|Connection error/i.test(err?.message ?? '')) return badRequest('Tidak bisa terhubung ke api.anthropic.com. Cek koneksi internet / proxy.');
  return badRequest(err?.message ?? 'Tes gagal');
}

async function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  return major >= MIN_NODE_MAJOR
    ? result('ok', `Node ${process.versions.node}`)
    : result('error', `Node ${process.versions.node}; butuh ${MIN_NODE_MAJOR}+`, { fix: 'Install Node.js LTS terbaru dari nodejs.org' });
}

async function checkClaudeInstalled() {
  const r = await run('claude', ['--version'], { timeout: 15_000 });
  return r.ok
    ? result('ok', r.out)
    : result('error', 'Perintah `claude` tidak ditemukan', { fix: 'npm install -g @anthropic-ai/claude-code   (atau installer resmi Claude Code)' });
}

async function checkClaudeAuth() {
  const r = await run('claude', ['auth', 'status'], { timeout: 20_000 });
  if (!r.ok) return result('error', 'Belum login ke Claude Code', { fix: 'claude auth login' });
  try {
    const s = JSON.parse(r.out);
    if (!s.loggedIn) return result('error', 'Belum login ke Claude Code', { fix: 'claude auth login' });
    return result('ok', `Login (${s.authMethod ?? 'akun'}${s.apiProvider && s.apiProvider !== 'firstParty' ? `, ${s.apiProvider}` : ''})`);
  } catch {
    return result('warn', r.out.slice(0, 200));
  }
}

async function checkPlugin() {
  const r = await run('claude', ['plugin', 'list', '--json'], { timeout: 20_000 });
  if (!r.ok) return result('warn', 'Tidak bisa membaca daftar plugin');
  const installed = (() => { try { return JSON.parse(r.out); } catch { return []; } })();
  const found = installed.some((p) => String(p.name ?? p.id ?? p).includes('doz-agent'));
  return found
    ? result('ok', 'Plugin doz-agent ter-install di Claude Code')
    : result('warn', 'Plugin doz-agent belum ter-install. Studio tetap jalan (memakai --plugin-dir), tapi /doz-agent:run-workflow di terminal butuh plugin ini.', {
      fix: '/plugin marketplace add yosiaamado/doz-agent   lalu   /plugin install doz-agent@doz-agent   (di dalam Claude Code)',
    });
}

async function checkGit(cwd) {
  const version = await run('git', ['--version']);
  if (!version.ok) return result('error', 'git tidak ditemukan', { fix: 'Install git dari git-scm.com' });
  const [name, email] = await Promise.all([run('git', ['config', 'user.name'], { cwd }), run('git', ['config', 'user.email'], { cwd })]);
  if (!name.out || !email.out) return result('warn', `${version.out}; user.name/user.email belum diisi (commit akan gagal)`, { action: 'git-identity' });
  return result('ok', `${version.out} · ${name.out} <${email.out}>`, { name: name.out, email: email.out });
}

async function checkRepo(cwd, label) {
  const inside = await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  if (!inside.ok) return result('warn', `${label} bukan repo git (diff per node & sync GitHub tidak tersedia)`, { fix: 'git init && git remote add origin <url-github>' });
  const remote = await run('git', ['remote', 'get-url', 'origin'], { cwd });
  if (!remote.ok) return result('warn', `${label} belum punya remote origin`, { fix: 'git remote add origin https://github.com/<user>/<repo>.git' });
  return result('ok', `${label}: ${redactText(remote.out)}`);
}

export function createSetupService({ config, apiRunner, claudeRunner }) {
  const checks = async () => {
    const workdir = config.getWorkdir();
    const [node, claude, claudeAuth, plugin, git, repo, project] = await Promise.all([
      checkNode(), checkClaudeInstalled(), checkClaudeAuth(), checkPlugin(), checkGit(workdir),
      checkRepo(config.repoRoot, 'Repo doz-agent'), checkRepo(workdir, 'Project aktif'),
    ]);
    const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    const apiKey = hasKey
      ? result('ok', `API key terpasang${config.savedApiKey() ? ' (disimpan di studio)' : ' (dari environment)'}`)
      : result('warn', 'Belum ada API key. Opsional kalau kamu memakai runner claude-cli.', { action: 'api-key' });
    return { node, claude, claudeAuth, plugin, apiKey, git, repo, project, workdir, state: config.setupState() };
  };

  const tests = {
    // Menjalankan `claude -p` sungguhan dengan haiku, 1 turn.
    'claude-cli': async () => {
      const started = Date.now();
      const res = await claudeRunner.judge({ prompt: 'Balas satu kata: ok', settings: { model: 'haiku' }, workdir: config.getWorkdir(), signal: AbortSignal.timeout(90_000) });
      return result('ok', `claude -p membalas "${res.output.trim().slice(0, 40)}" dalam ${Date.now() - started} ms`, { cost: res.cost });
    },
    api: async () => {
      if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) throw badRequest('Isi API key dulu');
      const res = await apiRunner.testApiConnection();
      return result('ok', `${res.model} membalas "${res.reply}" dalam ${res.ms} ms`);
    },
    // Membaca remote tanpa mengubah apa pun: membuktikan kredensial GitHub bisa dipakai.
    github: async (target = 'repo') => {
      const cwd = target === 'workdir' ? config.getWorkdir() : config.repoRoot;
      const r = await run('git', ['ls-remote', '--heads', 'origin'], { cwd, timeout: 45_000 });
      if (!r.ok) throw badRequest(`Tidak bisa mengakses GitHub: ${r.err.split('\n').slice(-3).join(' ')}`);
      return result('ok', `Terhubung ke origin (${r.out.split('\n').filter(Boolean).length} branch terbaca)`);
    },
  };

  return {
    check: checks,
    async test(name, target) {
      const fn = tests[name];
      if (!fn) throw badRequest(`tes tidak dikenal: ${name}`);
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
      apiRunner.resetClient();
      config.saveApiKey(remember ? key : null);
      return { saved: remember, masked: `${key.slice(0, 7)}…${key.slice(-4)}` };
    },
    clearApiKey() {
      delete process.env.ANTHROPIC_API_KEY;
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
    // `claude auth login` membuka browser di komputer ini. URL login dikembalikan kalau browser tidak terbuka otomatis.
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
