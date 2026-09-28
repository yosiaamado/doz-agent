// Snapshot working tree lewat index sementara (tanpa mengubah index/branch user), supaya perubahan file
// per node bisa dihitung: snapshot sebelum node jalan vs sesudah. Termasuk file baru yang belum di-track.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const SHA_RE = /^[0-9a-f]{40,64}$/;

function git(cwd, args, env = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout);
    });
  });
}

export async function isGitRepo(cwd) {
  try {
    return (await git(cwd, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true';
  } catch {
    return false;
  }
}

export async function snapshot(cwd) {
  if (!(await isGitRepo(cwd))) return null;
  const top = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
  const realIndex = (await git(cwd, ['rev-parse', '--git-path', 'index'])).trim();
  const tmpIndex = path.join(os.tmpdir(), `doz-index-${crypto.randomBytes(6).toString('hex')}`);
  try {
    const absIndex = path.resolve(cwd, realIndex);
    if (fs.existsSync(absIndex)) fs.copyFileSync(absIndex, tmpIndex);
    const env = { GIT_INDEX_FILE: tmpIndex };
    await git(top, ['add', '-A', '--', '.', ':(exclude,glob)**/.doz-studio/**'], env);
    return (await git(top, ['write-tree'], env)).trim();
  } finally {
    fs.rmSync(tmpIndex, { force: true });
  }
}

export async function changes(cwd, base, head) {
  if (!base || !head || base === head) return [];
  const [status, numstat] = await Promise.all([
    git(cwd, ['diff', '--name-status', '-M', base, head]),
    git(cwd, ['diff', '--numstat', '-M', base, head]),
  ]);
  const counts = {};
  for (const line of numstat.trim().split('\n').filter(Boolean)) {
    const [add, del, ...rest] = line.split('\t');
    counts[rest.at(-1)] = { additions: add === '-' ? null : Number(add), deletions: del === '-' ? null : Number(del) };
  }
  return status.trim().split('\n').filter(Boolean).map((line) => {
    const [code, ...paths] = line.split('\t');
    const file = paths.at(-1);
    const kind = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed' }[code[0]] ?? 'modified';
    return { path: file, from: paths.length > 1 ? paths[0] : undefined, status: kind, ...(counts[file] ?? {}) };
  });
}

export async function fileDiff(cwd, base, head, file) {
  if (!SHA_RE.test(base) || !SHA_RE.test(head)) throw Object.assign(new Error('snapshot tidak valid'), { status: 400 });
  const args = ['diff', '-M', base, head];
  if (file) args.push('--', file);
  return git(cwd, args);
}
