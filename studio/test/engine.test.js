import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WorkflowRun } from '../server/domain/engine.js';
import { parseWorkflow, normalize, resolveSettings, validateWorkflow } from '../server/domain/workflow.js';
import { parseVerdict } from '../server/domain/prompt.js';
import { buildArgs, agentDefinition } from '../server/runners/claude-cli.js';
import { confine, globToRegExp, toolsFor } from '../server/runners/tools.js';

const agents = ['product-owner', 'backend-engineer', 'qa-tester', 'code-reviewer', 'security-tester', 'system-analyst', 'frontend-engineer', 'devops-engineer']
  .map((name) => ({ name, description: name, tools: ['Read', 'Edit', 'Bash'], model: 'sonnet', prompt: `you are ${name}` }));

// A fake runner: the output per agent comes from a script (an array = the answers in order, one per call).
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

async function run(wf, script, input = 'build feature X', onEvent, actions = []) {
  const runner = fakeRunner(script);
  const events = [];
  const r = new WorkflowRun({
    id: 't', wf: normalize(wf), agents, actions, input, workdir: '.', runners: { 'claude-cli': runner, api: runner },
    emit: (e) => { events.push(e); onEvent?.(e, r); },
  });
  const status = await r.start();
  return { status, r, runner, events };
}

const exampleFile = path.join(import.meta.dirname, '../../plugins/workflows/fitur-kecil.md');

test('the example workflow is valid and runs in order', async () => {
  const wf = parseWorkflow(fs.readFileSync(exampleFile, 'utf8'));
  assert.deepEqual(validateWorkflow(wf, agents.map((a) => a.name)), []);
  const { status, r, runner } = await run(wf, { qa: ['everything passed\nVERDICT: PASS'] });
  assert.equal(status, 'done');
  assert.deepEqual(runner.calls.map((c) => c.node), ['po', 'be', 'qa']);
  assert.equal(r.state.selesai.status, 'done');
  assert.match(runner.calls[1].prompt, /Follow the existing code patterns/); // the node info reaches the be context
  assert.match(runner.calls[1].prompt, /### Scope & acceptance criteria/); // the po output is passed along
});

test('a loop replays be+qa with feedback and then passes', async () => {
  const wf = parseWorkflow(fs.readFileSync(exampleFile, 'utf8'));
  const { status, runner, r } = await run(wf, { qa: ['bug A\nVERDICT: FAIL', 'still bug B\nVERDICT: FAIL', 'VERDICT: PASS'] });
  assert.equal(status, 'done');
  assert.deepEqual(runner.calls.map((c) => c.node), ['po', 'be', 'qa', 'be', 'qa', 'be', 'qa']);
  assert.match(runner.calls[3].prompt, /attempt 2[\s\S]*bug A/);
  assert.match(runner.calls[5].prompt, /attempt 3[\s\S]*still bug B/);
  assert.equal(r.state.selesai.status, 'done');
});

test('the loop stops once the limit is used up', async () => {
  const wf = parseWorkflow(fs.readFileSync(exampleFile, 'utf8'));
  const { status, r } = await run(wf, { qa: ['VERDICT: FAIL'] });
  assert.equal(status, 'failed');
  assert.match(r.error, /Loop limit lolos->be/);
  assert.equal(r.errorCode, 'NODE_FAILED');
});

test('the branch that was not picked is skipped, the parallel branch runs', async () => {
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

test('approval waits for a human decision', async () => {
  const wf = parseWorkflow(fs.readFileSync(path.join(path.dirname(exampleFile), 'review-pr.md'), 'utf8'));
  const { status, r } = await run(wf, {}, 'review', (e, run) => {
    if (e.type === 'node' && e.status === 'waiting') setTimeout(() => run.approve(e.node, false, 'fix this first'));
  });
  assert.equal(status, 'done');
  assert.equal(r.state.ok.status, 'skipped');
  assert.equal(r.state.revisi.status, 'done');
  assert.match(r.state.putuskan.output, /Rejected: fix this first/);
});

test('the workflow budget stops the run', async () => {
  const wf = parseWorkflow(fs.readFileSync(exampleFile, 'utf8'));
  wf.budget_usd = 0.15;
  const { status, r } = await run(wf, {});
  assert.equal(status, 'failed');
  assert.match(r.error, /budget/);
});

test('validation catches a cycle without a loop and a condition edge without when', () => {
  const errs = validateWorkflow(normalize({
    nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'agent', agent: 'x' }, { id: 'c', type: 'condition', check: '?' }],
    edges: [{ from: 's', to: 'a' }, { from: 'a', to: 'c' }, { from: 'c', to: 'a' }],
  }), ['y']);
  assert.ok(errs.some((e) => e.includes('cycle')));
  assert.ok(errs.some((e) => e.includes('when')));
  assert.ok(errs.some((e) => e.includes('is not in plugins/agents')));
});

test('settings: node > defaults > agent', () => {
  const wf = normalize({ defaults: { runner: 'api', model: 'opus', retry: 1 } });
  const s = resolveSettings({ model: 'haiku' }, wf, { model: 'sonnet', maxTurns: 40, effort: 'high' });
  assert.equal(s.runner, 'api');
  assert.equal(s.model, 'haiku');
  assert.equal(s.max_turns, 40);
  assert.equal(s.effort, 'high');
  assert.equal(s.retry, 1);
  assert.equal(resolveSettings({}, normalize({}), { model: 'sonnet' }).model, 'sonnet');
});

test('the verdict is taken from the last line', () => {
  assert.equal(parseVerdict('VERDICT: FAIL\n...\n**VERDICT: PASS**'), true);
  assert.equal(parseVerdict('no verdict here'), null);
});

test('claude-cli arguments: read-only drops the write tools, the prompt is not in the arguments', () => {
  const opts = { node: { type: 'agent' }, agent: agents[1], settings: { permission: 'read-only', model: 'opus', max_turns: 10 }, prompt: 'secret' };
  const args = buildArgs(opts, { agentsFile: '/tmp/a.json', pluginDir: '/p' });
  assert.deepEqual(agentDefinition(agents[1], 'read-only')['backend-engineer'].tools, ['Read', 'Bash']);
  assert.equal(args[args.indexOf('--agents') + 1], '/tmp/a.json');
  assert.ok(!args.includes('--permission-mode'));
  assert.ok(!args.join(' ').includes('secret'));
  assert.match(args[args.indexOf('--allowedTools') + 1], /Bash\(git diff:\*\)/);
  assert.equal(args[args.indexOf('--model') + 1], 'opus');
  assert.equal(args[args.indexOf('--plugin-dir') + 1], '/p');
});

test('api tools: paths are confined to the workdir, plus glob and tool mapping', () => {
  assert.throws(() => confine('/tmp/proj', '../etc/passwd'), /outside the workdir/);
  assert.equal(confine('/tmp/proj', 'src/a.ts'), '/tmp/proj/src/a.ts');
  assert.ok(globToRegExp('src/**/*.{ts,tsx}').test('src/a/b/c.tsx'));
  assert.ok(!globToRegExp('*.ts').test('src/a.ts'));
  assert.deepEqual(toolsFor(['Read', 'Edit', 'Bash'], 'read-only').map((t) => t.name), ['read_file']);
});

test('action: the exit code becomes the verdict and the condition uses it', async () => {
  const wf = {
    name: 'a',
    nodes: [
      { id: 's', type: 'start' },
      { id: 'tes', type: 'action', command: 'echo hello && exit 3' },
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
  assert.match(r.state.tes.output, /hello/);
  assert.equal(r.state.gagal.status, 'done');
  assert.equal(r.state.ok.status, 'skipped');
});

test('every workflow template in plugins/workflows is valid and can run to completion', async () => {
  const dir = path.dirname(exampleFile);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  assert.ok(files.length >= 6);
  const actions = [{ name: 'jalankan-test', command: 'true' }, { name: 'cek-perubahan', command: 'true' }];
  for (const f of files) {
    const wf = parseWorkflow(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.deepEqual(validateWorkflow(wf, agents.map((a) => a.name)), [], f);
    const approveAll = (e, r) => { if (e.type === 'node' && e.status === 'waiting') setTimeout(() => r.approve(e.node, true)); };
    const { status, r } = await run(wf, {}, 'x', approveAll, actions);
    assert.equal(status, 'done', `${f}: ${r.error}`);
    const outputs = wf.nodes.filter((n) => n.type === 'output').map((n) => r.state[n.id].status);
    assert.ok(outputs.includes('done'), `${f}: no output was reached`);
  }
});
