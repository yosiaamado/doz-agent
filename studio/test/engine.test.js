import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WorkflowRun } from '../server/engine.js';
import { parseWorkflow, normalize, resolveSettings, validateWorkflow } from '../server/workflow.js';
import { parseVerdict } from '../server/prompt.js';
import { buildArgs } from '../server/runners/claude-cli.js';
import { confine, globToRegExp, toolsFor } from '../server/runners/tools.js';

const agents = ['product-owner', 'backend-engineer', 'qa-tester', 'code-reviewer', 'security-tester']
  .map((name) => ({ name, description: name, tools: ['Read', 'Edit', 'Bash'], model: 'sonnet', prompt: `kamu ${name}` }));

// Runner palsu: output per agent diambil dari skrip (array = jawaban berurutan tiap panggilan).
function fakeRunner(script) {
  const calls = [];
  const runner = {
    calls,
    async run({ node, prompt }) {
      calls.push({ node: node.id, prompt });
      const answers = script[node.id] ?? ['ok'];
      const n = calls.filter((c) => c.node === node.id).length;
      return { output: answers[Math.min(n, answers.length) - 1], cost: 0.1 };
    },
    async judge() {
      return { output: 'VERDICT: PASS', cost: 0.01 };
    },
  };
  return runner;
}

async function run(wf, script, input = 'bikin fitur X', onEvent) {
  const runner = fakeRunner(script);
  const events = [];
  const r = new WorkflowRun({
    id: 't', wf: normalize(wf), agents, input, workdir: '.', runners: { 'claude-cli': runner, api: runner },
    emit: (e) => { events.push(e); onEvent?.(e, r); },
  });
  const status = await r.start();
  return { status, r, runner, events };
}

const exampleFile = path.join(import.meta.dirname, '../../plugins/workflows/fitur-kecil.md');

test('contoh workflow valid dan jalan berurutan', async () => {
  const wf = parseWorkflow(fs.readFileSync(exampleFile, 'utf8'));
  assert.deepEqual(validateWorkflow(wf, agents.map((a) => a.name)), []);
  const { status, r, runner } = await run(wf, { qa: ['semua lolos\nVERDICT: PASS'] });
  assert.equal(status, 'done');
  assert.deepEqual(runner.calls.map((c) => c.node), ['po', 'be', 'qa']);
  assert.equal(r.state.selesai.status, 'done');
  assert.match(runner.calls[1].prompt, /Ikuti pola kode/); // node info masuk ke konteks be
  assert.match(runner.calls[1].prompt, /### Scope & acceptance criteria/); // output po diteruskan
});

test('loop mengulang be+qa dengan umpan balik lalu lolos', async () => {
  const wf = parseWorkflow(fs.readFileSync(exampleFile, 'utf8'));
  const { status, runner, r } = await run(wf, { qa: ['bug A\nVERDICT: FAIL', 'masih bug B\nVERDICT: FAIL', 'VERDICT: PASS'] });
  assert.equal(status, 'done');
  assert.deepEqual(runner.calls.map((c) => c.node), ['po', 'be', 'qa', 'be', 'qa', 'be', 'qa']);
  assert.match(runner.calls[3].prompt, /percobaan ke-2[\s\S]*bug A/);
  assert.match(runner.calls[5].prompt, /percobaan ke-3[\s\S]*masih bug B/);
  assert.equal(r.state.selesai.status, 'done');
});

test('loop berhenti saat batas habis', async () => {
  const wf = parseWorkflow(fs.readFileSync(exampleFile, 'utf8'));
  const { status, r } = await run(wf, { qa: ['VERDICT: FAIL'] });
  assert.equal(status, 'failed');
  assert.match(r.error, /Batas loop lolos->be \(2x\)/);
});

test('cabang yang tidak dipilih di-skip, cabang paralel jalan', async () => {
  const wf = {
    name: 'p',
    nodes: [
      { id: 's', type: 'start' },
      { id: 'a', type: 'agent', agent: 'code-reviewer' },
      { id: 'b', type: 'agent', agent: 'security-tester' },
      { id: 'c', type: 'condition', source: 'a', check: 'ok?' },
      { id: 'yes', type: 'agent', agent: 'backend-engineer' },
      { id: 'no', type: 'agent', agent: 'qa-tester' },
      { id: 'end', type: 'output' },
    ],
    edges: [
      { from: 's', to: 'a' }, { from: 's', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'c' },
      { from: 'c', to: 'yes', when: true }, { from: 'c', to: 'no', when: false },
      { from: 'yes', to: 'end' }, { from: 'no', to: 'end' },
    ],
  };
  const { status, r, runner } = await run(wf, { a: ['VERDICT: FAIL'] });
  assert.equal(status, 'done');
  assert.equal(r.state.yes.status, 'skipped');
  assert.equal(r.state.no.status, 'done');
  assert.equal(r.state.end.status, 'done');
  assert.deepEqual(runner.calls.map((c) => c.node).slice(0, 2).sort(), ['a', 'b']);
});

test('approval menunggu keputusan manusia', async () => {
  const wf = parseWorkflow(fs.readFileSync(path.join(path.dirname(exampleFile), 'review-pr.md'), 'utf8'));
  const { status, r } = await run(wf, {}, 'review', (e, run) => {
    if (e.type === 'node' && e.status === 'waiting') setTimeout(() => run.approve(e.node, false, 'perbaiki dulu'));
  });
  assert.equal(status, 'done');
  assert.equal(r.state.ok.status, 'skipped');
  assert.equal(r.state.revisi.status, 'done');
  assert.match(r.state.putuskan.output, /Ditolak: perbaiki dulu/);
});

test('budget workflow menghentikan run', async () => {
  const wf = parseWorkflow(fs.readFileSync(exampleFile, 'utf8'));
  wf.budget_usd = 0.15;
  const { status, r } = await run(wf, {});
  assert.equal(status, 'failed');
  assert.match(r.error, /Budget/);
});

test('validasi menangkap siklus tanpa loop dan edge condition tanpa when', () => {
  const errs = validateWorkflow(normalize({
    nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'agent', agent: 'x' }, { id: 'c', type: 'condition', check: '?' }],
    edges: [{ from: 's', to: 'a' }, { from: 'a', to: 'c' }, { from: 'c', to: 'a' }],
  }), ['y']);
  assert.ok(errs.some((e) => e.includes('siklus')));
  assert.ok(errs.some((e) => e.includes('when')));
  assert.ok(errs.some((e) => e.includes('tidak ada di plugins/agents')));
});

test('pengaturan: node > defaults > agent', () => {
  const wf = normalize({ defaults: { runner: 'api', model: 'opus', retry: 1 } });
  const s = resolveSettings({ model: 'haiku' }, wf, { model: 'sonnet', maxTurns: 40, effort: 'high' });
  assert.equal(s.runner, 'api');
  assert.equal(s.model, 'haiku');
  assert.equal(s.max_turns, 40);
  assert.equal(s.effort, 'high');
  assert.equal(s.retry, 1);
  assert.equal(resolveSettings({}, normalize({}), { model: 'sonnet' }).model, 'sonnet');
});

test('verdict diambil dari baris terakhir', () => {
  assert.equal(parseVerdict('VERDICT: FAIL\n...\n**VERDICT: PASS**'), true);
  assert.equal(parseVerdict('tanpa verdict'), null);
});

test('argumen claude-cli: read-only membuang tool tulis', () => {
  const args = buildArgs({ node: { type: 'agent' }, agent: agents[1], settings: { permission: 'read-only', model: 'opus', max_turns: 10 }, prompt: 'x' });
  const def = JSON.parse(args[args.indexOf('--agents') + 1]);
  assert.deepEqual(def['backend-engineer'].tools, ['Read', 'Bash']);
  assert.ok(!args.includes('--permission-mode'));
  assert.match(args[args.indexOf('--allowedTools') + 1], /Bash\(git diff:\*\)/);
  assert.equal(args[args.indexOf('--model') + 1], 'opus');
});

test('tool api: path dikurung di workdir, glob dan mapping tool', () => {
  assert.throws(() => confine('/tmp/proj', '../etc/passwd'), /di luar workdir/);
  assert.equal(confine('/tmp/proj', 'src/a.ts'), '/tmp/proj/src/a.ts');
  assert.ok(globToRegExp('src/**/*.{ts,tsx}').test('src/a/b/c.tsx'));
  assert.ok(!globToRegExp('*.ts').test('src/a.ts'));
  assert.deepEqual(toolsFor(['Read', 'Edit', 'Bash'], 'read-only').map((t) => t.name), ['read_file']);
});

test('action: exit code jadi verdict dan condition memakainya', async () => {
  const wf = {
    name: 'a',
    nodes: [
      { id: 's', type: 'start' },
      { id: 'tes', type: 'action', command: 'echo halo && exit 3' },
      { id: 'c', type: 'condition', source: 'tes' },
      { id: 'ok', type: 'output' },
      { id: 'gagal', type: 'output' },
    ],
    edges: [{ from: 's', to: 'tes' }, { from: 'tes', to: 'c' }, { from: 'c', to: 'ok', when: true }, { from: 'c', to: 'gagal', when: false }],
  };
  const { status, r } = await run(wf, {});
  assert.equal(status, 'done');
  assert.equal(r.state.tes.verdict, false);
  assert.equal(r.state.tes.exitCode, 3);
  assert.match(r.state.tes.output, /halo/);
  assert.equal(r.state.gagal.status, 'done');
  assert.equal(r.state.ok.status, 'skipped');
});
