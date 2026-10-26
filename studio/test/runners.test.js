import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClaudeCliRunner, reduceStreamEvent, toRunResult, buildArgs } from '../server/runners/claude-cli.js';
import { runCommand } from '../server/runners/shell.js';
import { assertLocalRequest } from '../server/http/middleware.js';
import { createApiRunner, estimateCost, resolveModel } from '../server/runners/api.js';
import { runTool, toolsFor } from '../server/runners/tools.js';
import { describeTool, touchedFile } from '../server/runners/activity.js';
import { createUsageService } from '../server/services/usageService.js';
import { RunRegistry } from '../server/repositories/runLogRepository.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-run-'));

// A fake "claude": reads the prompt from stdin then emits stream-json like the real CLI.
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
    { type: 'text', text: 'done: ' + input.trim() },
  ] } });
  out({ type: 'result', subtype: 'success', result: 'result ' + input.trim(), total_cost_usd: 0.02, num_turns: 2, usage: { input_tokens: 10, output_tokens: 5 } });
});
`);
fs.chmodSync(fakeBin, 0o755);

test('claude-cli runner: prompt over stdin, activity, usage, rate limit, result', async () => {
  const limits = [];
  const runner = createClaudeCliRunner({ bin: fakeBin, pluginDir: '/p', onRateLimit: (i) => limits.push(i) });
  const activities = [];
  const usages = [];
  const res = await runner.run({
    node: { type: 'agent' },
    agent: { name: 'qa', description: 'd', tools: ['Read', 'Edit'], prompt: 'p' },
    settings: {}, prompt: 'hello', workdir: tmp, signal: new AbortController().signal,
    onActivity: (a) => activities.push(a), onUsage: (u) => usages.push(u),
  });
  assert.equal(res.output, 'result hello');
  assert.equal(res.cost, 0.02);
  assert.equal(res.turns, 2);
  assert.equal(limits[0].unifiedWindows.seven_day.utilization, 0.2);
  assert.deepEqual(usages.at(-1), { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 });
  assert.ok(activities.some((a) => a.kind === 'tool' && a.file === 'a.txt'));
  assert.ok(activities.some((a) => a.kind === 'init' && a.model === 'fake-model'));
  assert.equal((await runner.judge({ prompt: 'x', settings: {}, workdir: tmp })).output, 'result x');
});

test('stream: max_turns becomes a warning, other errors are thrown', () => {
  const base = { result: null, lastText: 'last text', usageById: {} };
  const warn = toRunResult({ ...base, result: { subtype: 'error_max_turns', is_error: true } });
  assert.equal(warn.output, 'last text');
  assert.match(warn.warning, /max_turns/);
  assert.throws(() => toRunResult({ ...base, result: { subtype: 'error', is_error: true, result: 'failed' } }), /failed/);
  const errors = [];
  reduceStreamEvent(base, { type: 'user', message: { content: [{ type: 'tool_result', is_error: true, content: 'x' }] } }, { onActivity: (a) => errors.push(a) });
  assert.equal(errors[0].kind, 'tool_error');
});

test('api runner: model, cost, description', () => {
  assert.equal(resolveModel('sonnet'), 'claude-sonnet-5');
  assert.equal(resolveModel(undefined), 'claude-opus-5');
  assert.equal(estimateCost('claude-haiku-4-5', { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 }), 1);
  const runner = createApiRunner();
  assert.match(runner.describe({ agent: { tools: ['Read'] }, settings: { model: 'haiku' } }), /model claude-haiku-4-5 · max_turns 30 · tools: read_file/);
  assert.throws(() => runner.run({ node: { type: 'skill' }, settings: {} }), /claude-cli/);
});

test('local tools: write, read, edit, grep, glob, skill', async () => {
  const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-tools-'));
  await runTool('write_file', { path: 'src/a.js', content: 'const x = 1;\n' }, wd);
  await runTool('edit_file', { path: 'src/a.js', old_string: 'x = 1', new_string: 'x = 2' }, wd);
  assert.match(await runTool('read_file', { path: 'src/a.js' }, wd), /1\tconst x = 2;/);
  assert.match(await runTool('grep', { pattern: 'x = 2' }, wd), /src\/a.js:1/);
  assert.equal(await runTool('glob', { pattern: 'src/*.js' }, wd), 'src/a.js');
  assert.match(await runTool('bash', { command: 'echo hello' }, wd), /exit 0\nhello/);
  const skills = [{ name: 'doz-agent:x', file: path.join(wd, 'src/a.js') }];
  assert.match(await runTool('load_skill', { name: 'x' }, wd, { listSkills: () => skills }), /const x/);
  await assert.rejects(runTool('edit_file', { path: 'src/a.js', old_string: 'not there', new_string: '' }, wd), /0x/);
  assert.deepEqual(toolsFor(['Read', 'Skill'], null).map((t) => t.name), ['read_file', 'load_skill']);
  assert.equal(describeTool('Bash', { command: 'npm   test' }), 'Bash: npm test');
  assert.equal(touchedFile('Read', { file_path: 'a' }), undefined);
});

test('usage: the limits from rate_limit_event plus the tokens from the transcript', async () => {
  const projects = path.join(tmp, 'projects', 'p1');
  fs.mkdirSync(projects, { recursive: true });
  const now = new Date().toISOString();
  const line = (id, tokens) => JSON.stringify({ type: 'assistant', timestamp: now, message: { id, model: 'opus', usage: { input_tokens: tokens, output_tokens: 1 } } });
  fs.writeFileSync(path.join(projects, 's.jsonl'), [line('a', 10), line('a', 10), line('b', 20)].join('\n'));
  const usage = createUsageService({ usageFile: path.join(tmp, 'usage.json'), profiles: { spawnContext: () => ({ profileId: 'default', projectsDir: path.join(tmp, 'projects') }) }, probe: async () => {} });
  usage.recordRateLimit({ unifiedWindows: { five_hour: { utilization: 0.1 } } });
  const s = await usage.summary();
  assert.equal(s.limits.unifiedWindows.five_hour.utilization, 0.1);
  assert.equal(s.local.five_hour.tokens, 32); // message 'a' is counted once
  assert.equal((await usage.refresh()).local.seven_day.messages, 2);
});

test('run log: a run from Claude Code (a JSONL file) is read and summarized', async () => {
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

test('claude-cli args: read-only pipeline agents get no Bash (git --output can write files)', () => {
  const agent = { name: 'a', description: '', prompt: '', tools: ['Read', 'Bash', 'Edit'] };
  const args = buildArgs({ agent, settings: { permission: 'read-only' } }, { agentsFile: 'a.json' });
  assert.equal(args[args.indexOf('--allowedTools') + 1], 'Read');
  assert.equal(args.join(' ').includes('Bash('), false);
  const bare = buildArgs({ agent: null, settings: { permission: 'read-only' } }, {});
  assert.ok(bare[bare.indexOf('--disallowedTools') + 1].split(',').includes('Bash'));
});

test('api tools: bash runs with the shell env of the profile, not process.env (SEC-4)', async () => {
  const wd = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-tools-'));
  process.env.DOZ_TEST_SECRET = 'leak';
  try {
    const shellEnv = { ...process.env };
    delete shellEnv.DOZ_TEST_SECRET;
    const cmd = process.platform === 'win32' ? 'echo [%DOZ_TEST_SECRET%]' : 'echo "[$DOZ_TEST_SECRET]"';
    const out = await runTool('bash', { command: cmd }, wd, { shellEnv });
    assert.doesNotMatch(out, /leak/);
  } finally {
    delete process.env.DOZ_TEST_SECRET;
  }
});

test('runCommand: refuses to run without an explicit env', async () => {
  await assert.rejects(runCommand({ command: 'echo hi', workdir: '.' }), /explicit env/);
});

test('local server: the Origin must be this server\'s own port (D-C)', () => {
  const req = (origin, localPort = 4317) => ({ headers: { host: `127.0.0.1:${localPort}`, origin }, socket: { localPort } });
  assert.doesNotThrow(() => assertLocalRequest(req('http://127.0.0.1:4317')));
  assert.doesNotThrow(() => assertLocalRequest({ headers: { host: '127.0.0.1:4317' }, socket: { localPort: 4317 } }));
  assert.throws(() => assertLocalRequest(req('http://localhost:9999')), (e) => e.code === 'ORIGIN_FORBIDDEN');
  assert.throws(() => assertLocalRequest(req('http://localhost')), (e) => e.code === 'ORIGIN_FORBIDDEN');
});
