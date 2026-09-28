import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { composeFile, splitFile } from '../server/lib/frontmatter.js';
import { snapshot, changes, fileDiff } from '../server/infra/gitdiff.js';
import { describeCommand } from '../server/runners/claude-cli.js';

test('composeFile mengubah key tanpa membuang key lain', () => {
  const text = '---\nname: qa\n# komentar\ntools: Read, Bash\nexperimental:\n  cacheTtl: 1h\n---\n\nisi lama\n';
  const out = composeFile(text, { model: 'opus', tools: 'Read, Bash, Edit', name: 'lain' }, 'isi baru');
  const parts = splitFile(out);
  assert.equal(parts.meta.name, 'qa'); // ganti nama tidak lewat edit
  assert.equal(parts.meta.model, 'opus');
  assert.equal(parts.meta.tools, 'Read, Bash, Edit');
  assert.deepEqual(parts.meta.experimental, { cacheTtl: '1h' });
  assert.match(out, /# komentar/);
  assert.equal(parts.body.trim(), 'isi baru');
});

test('snapshot git menangkap file baru dan diubah per node', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-git-'));
  const g = (...args) => execFileSync('git', args, { cwd: dir });
  g('init', '-q');
  g('-c', 'user.email=a@b', '-c', 'user.name=a', 'commit', '-q', '--allow-empty', '-m', 'init');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'satu\n');
  const base = await snapshot(dir);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'satu\ndua\n');
  fs.writeFileSync(path.join(dir, 'b.txt'), 'baru\n');
  fs.mkdirSync(path.join(dir, '.doz-studio'));
  fs.writeFileSync(path.join(dir, '.doz-studio', 'x.jsonl'), '{}\n');
  const head = await snapshot(dir);
  const list = await changes(dir, base, head);
  assert.deepEqual(list.map((c) => [c.path, c.status, c.additions]), [['a.txt', 'modified', 1], ['b.txt', 'added', 1]]);
  assert.match(await fileDiff(dir, base, head, 'a.txt'), /\+dua/);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: dir }).toString().includes('A '), false); // index user tidak disentuh
});

test('command CLI bisa disalin dengan placeholder prompt', () => {
  const cmd = describeCommand({
    node: { type: 'agent' },
    agent: { name: 'qa-tester', description: 'x', tools: ['Read'], prompt: 'p', file: 'plugins/agents/qa-tester.md' },
    settings: { model: 'sonnet', max_turns: 40 },
    prompt: 'rahasia panjang',
  }, { pluginDir: '/repo/plugins' });
  assert.match(cmd, /^claude -p --output-format stream-json --verbose --agents agents.json --agent qa-tester/);
  assert.match(cmd, /< prompt.md/);
  assert.match(cmd, /isi plugins\/agents\/qa-tester.md/);
  assert.ok(!cmd.includes('rahasia'));
});
