import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRun, reduceRun, edgeState, runTokens, toFlow, fromFlow, validate, uniqueId } from '../web/src/lib/model.js';

const ev = (type, extra) => ({ type, ts: 1000, ...extra });

test('the run reducer: status, history per execution, live tokens', () => {
  let run = emptyRun('r');
  run = reduceRun(run, ev('run_start', { workflow: 'wf' }));
  run = reduceRun(run, ev('node', { node: 'a', status: 'running', startedAt: 1000 }));
  run = reduceRun(run, ev('node', { node: 'a', usage: { input: 10, output: 5 } }));
  assert.equal(runTokens(run), 15);
  run = reduceRun(run, { ...ev('node', { node: 'a', status: 'done', usage: { input: 20, output: 5 } }), ts: 3000 });
  run = reduceRun(run, ev('node', { node: 'a', status: 'running', startedAt: 4000 }));
  assert.equal(run.nodes.a.usage, undefined, 'a new execution starts from zero');
  assert.equal(run.nodes.a.history.length, 1);
  assert.equal(run.nodes.a.history[0].durationMs, 2000);
  run = reduceRun(run, ev('run_end', { status: 'done', cost: 0.5 }));
  assert.equal(run.status, 'done');
  assert.equal(run.cost, 0.5);
});

test('edge colors: green for the path already taken, blue leading to the active node, dim for the branch not picked', () => {
  const run = { ...emptyRun('r'), status: 'running', nodes: { a: { status: 'done', verdict: true }, b: { status: 'running' }, c: { status: 'skipped' } }, loops: {} };
  assert.equal(edgeState({ source: 'a', target: 'b', data: {} }, run, 'agent'), 'active');
  assert.equal(edgeState({ source: 'a', target: 'c', data: { when: false } }, run, 'condition'), 'dim');
  assert.equal(edgeState({ source: 'a', target: 'b', data: { loop: 2 } }, run, 'condition'), null);
  assert.equal(edgeState({ source: 'a', target: 'b', data: {} }, emptyRun(), 'agent'), null);
});

test('the workflow ⇄ canvas conversion preserves edges, loops, and note sizes', () => {
  const wf = {
    name: 'w', nodes: [{ id: 's', type: 'start' }, { id: 'n', type: 'info', text: 'x' }, { id: 'c', type: 'condition', check: '?' }],
    edges: [{ from: 's', to: 'c' }, { from: 'c', to: 's', when: false, loop: 2 }], layout: { n: [0, 0, 300, 200] },
  };
  const flow = toFlow(wf);
  const back = fromFlow({ name: 'w' }, flow.nodes, flow.edges);
  assert.deepEqual(back.edges, wf.edges);
  assert.deepEqual(back.layout.n, [0, 0, 300, 200]);
  assert.deepEqual(validate(back, []), []);
  assert.equal(uniqueId('QA Tester', new Set(['qa-tester'])), 'qa-tester-2');
});
