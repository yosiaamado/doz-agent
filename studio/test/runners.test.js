import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClaudeCliRunner, reduceStreamEvent, toRunResult } from '../server/runners/claude-cli.js';
import { createApiRunner, estimateCost, resolveModel } from '../server/runners/api.js';
import { runTool, toolsFor } from '../server/runners/tools.js';
import { describeTool, touchedFile } from '../server/runners/activity.js';
import { createUsageService } from '../server/services/usageService.js';
import { RunRegistry } from '../server/repositories/runLogRepository.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-run-'));

// "claude" palsu: membaca prompt dari stdin lalu mengeluarkan stream-json seperti CLI asli.
const fakeBin = path.join(tmp, 'fake-claude.mjs');
fs.writeFileSync(fakeBin, `#!/usr/bin/env node
let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  out({ type: 'system', subtype: 'init', model: 'fake-model', session_id: 's' });
  out({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', unifiedWindows: { seven_day: { utilization: 0.2 } } } });
  out({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 10, output_tokens: 5 }, content: [
    { type: 'tool_use', name: 'Edit', input: { file_path: process.cwd() + '/a.txt' } },
    { type: 'text', text: 'selesai: ' + input.trim() },
  ] } });
  out({ type: 'result', subtype: 'success', result: 'hasil ' + input.trim(), total_cost_usd: 0.02, num_turns: 2, usage: { input_tokens: 10, output_tokens: 5 } });
});
`);
fs.chmodSync(fakeBin, 0o755);

test('runner claude-cli: prompt lewat stdin, aktivitas, usage, rate limit, hasil', async () => {
  const limits = [];
  const runner = createClaudeCliRunner({ bin: fakeBin, pluginDir: '/p', onRateLimit: (i) => limits.push(i) });
  const activities = [];
  const usages = [];
  const res = await runner.run({
    node: { type: 'agent' },
    agent: { name: 'qa', description: 'd', tools: ['Read', 'Edit'], prompt: 'p' },
    settings: {}, prompt: 'halo', workdir: tmp, signal: new AbortController().signal,
    onActivity: (a) => activities.push(a), onUsage: (u) => usages.push(u),
  });
  assert.equal(res.output, 'hasil halo');
  assert.equal(res.cost, 0.02);
  assert.equal(res.turns, 2);
  assert.equal(limits[0].unifiedWindows.seven_day.utilization, 0.2);
  assert.deepEqual(usages.at(-1), { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 });
  assert.ok(activities.some((a) => a.kind === 'tool' && a.file === 'a.txt'));
  assert.ok(activities.some((a) => a.kind === 'init' && a.model === 'fake-model'));
  assert.equal((await runner.judge({ prompt: 'x', settings: {}, workdir: tmp })).output, 'hasil x');
});

test('stream: max_turns jadi warning, error lain dilempar', () => {
  const base = { result: null, lastText: 'teks terakhir', usageById: {} };
  const warn = toRunResult({ ...base, result: { subtype: 'error_max_turns', is_error: true } });
  assert.equal(warn.output, 'teks terakhir');
  assert.match(warn.warning, /max_turns/);
  assert.throws(() => toRunResult({ ...base, result: { subtype: 'error', is_error: true, result: 'gagal' } }), /gagal/);
  const errors = [];
  reduceStreamEvent(base, { type: 'user', message: { content: [{ type: 'tool_result', is_error: true, content: 'x' }] } }, { onActivity: (a) => errors.push(a) });
  assert.equal(errors[0].kind, 'tool_error');
});

test('runner api: model, biaya, deskripsi', () => {
  assert.equal(resolveModel('sonnet'), 'claude-sonnet-5');
  assert.equal(resolveModel(undefined), 'claude-opus-5');
  assert.equal(estimateCost('claude-haiku-4-5', { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 }), 1);
  const runner = createApiRunner();
  assert.match(runner.describe({ agent: { tools: ['Read'] }, settings: { model: 'haiku' } }), /model claude-haiku-4-5 · max_turns 30 · tools: read_file/);
  assert.throws(() => runner.run({ node: { type: 'skill' }, settings: {} }), /claude-cli/);
});

test('tool lokal: tulis, baca, edit, grep, glob, skill', async () => {
  const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-tools-'));
  await runTool('write_file', { path: 'src/a.js', content: 'const x = 1;\n' }, wd);
  await runTool('edit_file', { path: 'src/a.js', old_string: 'x = 1', new_string: 'x = 2' }, wd);
  assert.match(await runTool('read_file', { path: 'src/a.js' }, wd), /1\tconst x = 2;/);
  assert.match(await runTool('grep', { pattern: 'x = 2' }, wd), /src\/a.js:1/);
  assert.equal(await runTool('glob', { pattern: 'src/*.js' }, wd), 'src/a.js');
  assert.match(await runTool('bash', { command: 'echo halo' }, wd), /exit 0\nhalo/);
  const skills = [{ name: 'doz-agent:x', file: path.join(wd, 'src/a.js') }];
  assert.match(await runTool('load_skill', { name: 'x' }, wd, { listSkills: () => skills }), /const x/);
  await assert.rejects(runTool('edit_file', { path: 'src/a.js', old_string: 'tidak ada', new_string: '' }, wd), /0x/);
  assert.deepEqual(toolsFor(['Read', 'Skill'], null).map((t) => t.name), ['read_file', 'load_skill']);
  assert.equal(describeTool('Bash', { command: 'npm   test' }), 'Bash: npm test');
  assert.equal(touchedFile('Read', { file_path: 'a' }), undefined);
});

test('usage: batas dari rate_limit_event + token dari transcript', async () => {
  const projects = path.join(tmp, 'projects', 'p1');
  fs.mkdirSync(projects, { recursive: true });
  const now = new Date().toISOString();
  const line = (id, tokens) => JSON.stringify({ type: 'assistant', timestamp: now, message: { id, model: 'opus', usage: { input_tokens: tokens, output_tokens: 1 } } });
  fs.writeFileSync(path.join(projects, 's.jsonl'), [line('a', 10), line('a', 10), line('b', 20)].join('\n'));
  const usage = createUsageService({ usageFile: path.join(tmp, 'usage.json'), projectsDir: path.join(tmp, 'projects'), probe: async () => {} });
  usage.recordRateLimit({ unifiedWindows: { five_hour: { utilization: 0.1 } } });
  const s = await usage.summary();
  assert.equal(s.limits.unifiedWindows.five_hour.utilization, 0.1);
  assert.equal(s.local.five_hour.tokens, 32); // pesan 'a' dihitung sekali
  assert.equal((await usage.refresh()).local.seven_day.messages, 2);
});

test('run log: run dari Claude Code (file JSONL) terbaca dan diringkas', async () => {
  const dir = path.join(tmp, 'runs');
  fs.mkdirSync(dir);
  const seen = [];
  const log = new RunRegistry({ broadcast: (m) => seen.push(m) });
  log.watch(dir);
  const file = path.join(dir, 'cc-1.jsonl');
  fs.writeFileSync(file, `${JSON.stringify({ type: 'run_start', run: 'cc-1', workflow: 'wf', ts: 1 })}\n`);
  log.poll();
  fs.appendFileSync(file, `${JSON.stringify({ type: 'run_end', run: 'cc-1', status: 'done', ts: 5 })}\n`);
  log.poll();
  assert.deepEqual(seen.map((m) => m.event.type), ['run_start', 'run_end']);
  assert.equal(log.events('cc-1').length, 2);
  const summary = log.list().find((r) => r.id === 'cc-1');
  assert.equal(summary.status, 'done');
  assert.equal(log.events('../etc'), null);
  clearInterval(log.timer);
});
