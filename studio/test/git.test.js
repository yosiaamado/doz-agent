import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createGitService, parseStatus, redactRemote, redactText } from '../server/services/gitService.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-git-sync-'));
const g = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString();
const identity = (dir) => { g(dir, 'config', 'user.email', 'a@b.c'); g(dir, 'config', 'user.name', 'A'); };

// A fake "GitHub": a bare repo plus two clones (the studio and another laptop).
const remote = path.join(tmp, 'remote.git');
g(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
const a = path.join(tmp, 'a');
const b = path.join(tmp, 'b');
g(tmp, 'clone', '-q', remote, a);
identity(a);
fs.writeFileSync(path.join(a, 'README.md'), 'initial\n');
g(a, 'add', '-A');
g(a, 'commit', '-q', '-m', 'initial');
g(a, 'push', '-q', '-u', 'origin', 'main');
g(tmp, 'clone', '-q', remote, b);
identity(b);

const serviceFor = (dir) => createGitService({ repoRoot: dir, getWorkdir: () => tmp });

test('status: branch, upstream, changed files', async () => {
  fs.writeFileSync(path.join(a, 'agent.md'), 'new\n');
  const s = await serviceFor(a).status('repo');
  assert.equal(s.isRepo, true);
  assert.equal(s.branch, 'main');
  assert.equal(s.upstream, 'origin/main');
  assert.deepEqual(s.files.map((f) => [f.path, f.status]), [['agent.md', 'untracked']]);
  assert.equal((await serviceFor(a).status('workdir')).isRepo, false);
});

test('commit + push from one clone, then pull in the other', async () => {
  const git = serviceFor(a);
  const committed = await git.commit('repo', { message: 'add agent' });
  assert.equal(committed.status.files.length, 0);
  assert.equal(committed.status.ahead, 1);
  const pushed = await git.push('repo');
  assert.equal(pushed.status.ahead, 0);
  fs.writeFileSync(path.join(b, 'local.txt'), 'not committed yet\n');
  const pulled = await serviceFor(b).pull('repo');
  assert.ok(fs.existsSync(path.join(b, 'agent.md')));
  assert.ok(fs.existsSync(path.join(b, 'local.txt')), 'the local change survives (autostash)');
  assert.equal(pulled.status.behind, 0);
});

test('a branch without an upstream is created on origin at push time; git errors come back cleanly', async () => {
  g(a, 'checkout', '-q', '-b', 'fitur-x');
  fs.writeFileSync(path.join(a, 'x.txt'), 'x\n');
  const git = serviceFor(a);
  await git.commit('repo', { message: 'x' });
  const pushed = await git.push('repo');
  assert.equal(pushed.status.upstream, 'origin/fitur-x');
  await assert.rejects(git.commit('repo', { message: 'empty' }), /nothing to commit/);
  await assert.rejects(git.status('other'), /git target/);
});

test('parseStatus reads ahead/behind and conflicts', () => {
  const s = parseStatus('## main...origin/main [ahead 2, behind 1]\nUU a.txt\n M b.txt\nR  c.txt -> d.txt\n');
  assert.deepEqual([s.branch, s.upstream, s.ahead, s.behind], ['main', 'origin/main', 2, 1]);
  assert.deepEqual(s.files.map((f) => f.status), ['conflict', 'modified', 'renamed']);
  assert.equal(s.files[2].path, 'd.txt');
});

test('a token in the remote URL is masked', () => {
  assert.equal(redactRemote('https://user:ghp_rahasia@github.com/a/b.git'), 'https://***@github.com/a/b.git');
  assert.equal(redactRemote('git@github.com:a/b.git'), 'git@github.com:a/b.git');
  assert.equal(redactText("fatal: unable to access 'https://x:tok@github.com/a/'"), "fatal: unable to access 'https://***@github.com/a/'");
});
