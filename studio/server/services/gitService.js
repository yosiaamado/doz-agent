// Sinkronisasi dengan GitHub (atau remote git lain) memakai git lokal dan kredensial milik user.
// Target: 'repo' = repo doz-agent (agent/skill/workflow), 'workdir' = folder project aktif.
// Tidak pernah force push; pull memakai rebase + autostash supaya perubahan lokal tidak hilang.
import { execFile } from 'node:child_process';
import { badRequest } from '../lib/errors.js';

const TIMEOUT_MS = 120_000;
const STATUS_CODES = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied', '?': 'untracked', U: 'conflict' };

function git(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd, timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024,
      // Jangan menunggu input password di terminal server; kredensial harus sudah tersimpan (ssh key / credential helper).
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (err, stdout, stderr) => {
      if (err) reject(badRequest(redactText((stderr || stdout || err.message).trim().split('\n').slice(-6).join('\n'))));
      else resolve(redactText(`${stdout}${stderr}`.trim()));
    });
  });
}

// URL remote bisa berisi token (https://user:token@github.com/...). Jangan pernah dikirim ke UI.
export function redactRemote(url) {
  return url ? url.replace(/^(https?:\/\/)[^@/]+@/, '$1***@') : url;
}

export function redactText(text) {
  return text.replace(/(https?:\/\/)[^@\s/]+@/g, '$1***@');
}

export function parseStatus(porcelain) {
  const lines = porcelain.split('\n').filter(Boolean);
  const head = lines[0]?.startsWith('## ') ? lines.shift().slice(3) : '';
  const branchMatch = /^(?:No commits yet on )?([^.\s]+)(?:\.\.\.(\S+))?/.exec(head);
  const ahead = Number(/ahead (\d+)/.exec(head)?.[1] ?? 0);
  const behind = Number(/behind (\d+)/.exec(head)?.[1] ?? 0);
  const files = lines.map((line) => {
    const code = line.slice(0, 2);
    const key = code.includes('U') ? 'U' : (code.trim()[0] ?? '?');
    return { path: line.slice(3).split(' -> ').pop(), status: STATUS_CODES[key] ?? 'modified', staged: code[0] !== ' ' && code[0] !== '?' };
  });
  return { branch: branchMatch?.[1] ?? 'HEAD', upstream: branchMatch?.[2] ?? null, ahead, behind, files };
}

export function createGitService(config) {
  const dirOf = (target) => {
    if (target === 'repo') return config.repoRoot;
    if (target === 'workdir') return config.getWorkdir();
    throw badRequest('target git harus repo atau workdir');
  };

  const status = async (target) => {
    const cwd = dirOf(target);
    try {
      await git(cwd, ['rev-parse', '--is-inside-work-tree']);
    } catch {
      return { target, path: cwd, isRepo: false };
    }
    const [porcelain, remote, last] = await Promise.all([
      git(cwd, ['status', '--porcelain=v1', '--branch']),
      git(cwd, ['remote', 'get-url', 'origin']).catch(() => null),
      git(cwd, ['log', '-1', '--format=%h %s (%cr)']).catch(() => null),
    ]);
    return { target, path: cwd, isRepo: true, remote: redactRemote(remote), lastCommit: last, ...parseStatus(porcelain) };
  };

  const withStatus = async (target, output) => ({ output, status: await status(target) });

  return {
    status,
    async fetch(target) {
      return withStatus(target, await git(dirOf(target), ['fetch', '--prune', 'origin']));
    },
    async pull(target) {
      return withStatus(target, await git(dirOf(target), ['pull', '--rebase', '--autostash']));
    },
    async commit(target, { message, files }) {
      const cwd = dirOf(target);
      if (files?.length) await git(cwd, ['add', '--', ...files]);
      else await git(cwd, ['add', '-A']);
      return withStatus(target, await git(cwd, ['commit', '-m', message]));
    },
    // Push ke upstream; kalau branch belum punya upstream, dibuat di origin dengan nama yang sama.
    async push(target) {
      const cwd = dirOf(target);
      const current = await status(target);
      const args = current.upstream ? ['push'] : ['push', '-u', 'origin', current.branch];
      return withStatus(target, await git(cwd, args));
    },
  };
}
