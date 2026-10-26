import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyActivity, reduceActivity, hasActivity, MAX_LINES } from '../web/src/lib/activity.js';
import { emptyRun, reduceRun } from '../web/src/lib/model.js';

const run = (events, state = emptyActivity()) => events.reduce(reduceActivity, state);
const act = (kind, extra = {}) => ({ type: 'activity', node: 'n', kind, text: extra.text ?? kind, ts: 1, parentId: null, ...extra });

const START_T1 = act('subagent_start', { toolUseId: 't1', agent: 'qa-tester', text: 'qa-tester: Run QA' });
const CHILD_T1 = act('tool', { tool: 'Read', text: 'Read: a', parentId: 't1' });
const END_T1 = act('subagent_end', { toolUseId: 't1', isError: false, text: 'ok' });

test('web activity: reduceActivity nests, ends and replaces todos', () => {
  const s = run([START_T1, CHILD_T1, END_T1]);
  assert.equal(s.subagents.t1.lines.length, 1);
  assert.equal(s.subagents.t1.status, 'done');
  assert.equal(s.subagents.t1.agent, 'qa-tester');
  assert.equal(s.lines.length, 0);
  assert.deepEqual(s.order, ['t1']);

  const stray = run([act('tool', { text: 'Read: b', parentId: 'unknown' })]);
  assert.equal(stray.lines.length, 1);
  assert.equal(stray.order.length, 1);

  const todos = run([
    act('todo', { toolUseId: 'w1', todos: [{ content: 'A', status: 'pending' }] }),
    act('todo', { toolUseId: 'w2', todos: [{ content: 'B', status: 'completed' }, { content: 'C', status: 'in_progress', activeForm: 'Doing C' }] }),
  ]);
  assert.deepEqual(todos.todos.map((x) => x.content), ['B', 'C']);
});

test('web activity: old run logs without parentId render top level', () => {
  const s = run([{ type: 'activity', node: 'n', kind: 'tool', text: 'Read: a' }]);
  assert.equal(s.lines.length, 1);
  assert.equal(s.lines[0].text, 'Read: a');
  assert.equal(s.current, 'Read: a');
});

test('web activity: parallel subagents keep their own children and errors (RF-5)', () => {
  const s = run([
    act('subagent_start', { toolUseId: 't1', agent: 'a' }),
    act('subagent_start', { toolUseId: 't2', agent: 'b' }),
    act('tool', { text: 'Read: 1', parentId: 't1' }),
    act('tool', { text: 'Read: 2', parentId: 't2' }),
    act('tool_error', { text: 'boom', parentId: 't2', tool: 'Bash' }),
    act('subagent_end', { toolUseId: 't2', isError: true }),
    act('tool', { text: 'Read: 3', parentId: 't1' }),
  ]);
  assert.deepEqual(s.subagents.t1.lines.map((l) => l.text), ['Read: 1', 'Read: 3']);
  assert.deepEqual(s.subagents.t2.lines.map((l) => l.kind), ['tool', 'tool_error']);
  assert.equal(s.subagents.t1.status, 'running');
  assert.equal(s.subagents.t2.status, 'failed');
  assert.deepEqual(s.order, ['t1', 't2']);
});

test('web activity: nested groups hang under their parent, and a self or forward parent cannot loop', () => {
  const s = run([
    act('subagent_start', { toolUseId: 't1', agent: 'a' }),
    act('subagent_start', { toolUseId: 't2', agent: 'b', parentId: 't1' }),
    act('subagent_start', { toolUseId: 't3', agent: 'c', parentId: 't3' }),
    act('subagent_start', { toolUseId: 't4', agent: 'd', parentId: 't5' }),
    act('subagent_start', { toolUseId: 't5', agent: 'e', parentId: 't4' }),
  ]);
  assert.equal(s.subagents.t2.parentId, 't1');
  assert.equal(s.subagents.t3.parentId, null);
  assert.equal(s.subagents.t4.parentId, null);
  assert.equal(s.subagents.t5.parentId, 't4');
  assert.deepEqual(s.order, ['t1', 't3', 't4']);
});

test('web activity: init, rate limit, blocked, missing fields and caps', () => {
  const s = run([
    act('init', { text: 'model m', init: { model: 'm', sessionId: 'sess', apiKeySource: 'none', mcpServers: [{ name: 'gh', status: 'failed' }] } }),
    act('rate_limit', { rateLimit: { status: 'allowed_warning', rateLimitType: 'five_hour', resetsAt: 1, utilization: 0.83 } }),
    act('blocked', { tool: 'Write', text: 'permission denied' }),
  ]);
  assert.equal(s.sessionId, 'sess');
  assert.equal(s.init.mcpServers[0].status, 'failed');
  assert.equal(s.rateLimit.utilization, 0.83);
  assert.equal(s.lines[0].kind, 'blocked');
  assert.ok(hasActivity(s));
  assert.ok(!hasActivity(emptyActivity()));
  const legacy = run([{ type: 'activity', kind: 'init', text: 'model m', model: 'm', session: 's9' }]);
  assert.equal(legacy.init.model, 'm');
  assert.equal(legacy.sessionId, 's9');
  assert.doesNotThrow(() => run([act('subagent_end', { toolUseId: 'nope' }), act('todo', {}), act('subagent_start', {})]));

  const many = run(Array.from({ length: MAX_LINES + 20 }, (_, i) => act('tool', { text: `L${i}` })));
  assert.equal(many.lines.length, MAX_LINES);
  assert.equal(many.order.length, MAX_LINES);
  assert.equal(many.lines.at(-1).text, `L${MAX_LINES + 19}`);
});

test('web activity: reduceRun keeps the stream, agent, label and next on the node; a new execution resets it', () => {
  let r = emptyRun('r');
  r = reduceRun(r, { type: 'node', node: 'build', status: 'running', agent: 'backend-engineer', label: 'Build', next: [{ id: 'review', label: 'Review' }], ts: 1 });
  r = reduceRun(r, { ...START_T1, node: 'build' });
  r = reduceRun(r, { ...CHILD_T1, node: 'build' });
  const node = r.nodes.build;
  assert.equal(node.agent, 'backend-engineer');
  assert.equal(node.label, 'Build');
  assert.equal(node.next[0].label, 'Review');
  assert.equal(node.stream.subagents.t1.lines.length, 1);
  assert.equal(node.activity, 'Read: a');
  assert.equal(node.stream.current, 'Read: a');
  r = reduceRun(r, { type: 'node', node: 'build', status: 'done', ts: 2 });
  assert.ok(r.nodes.build.stream, 'the stream survives the end of the node');
  r = reduceRun(r, { type: 'node', node: 'build', status: 'running', agent: 'backend-engineer', ts: 3 });
  assert.equal(r.nodes.build.stream, undefined, 'a loop or retry starts from an empty stream');
  assert.equal(reduceRun(r, act('text', { node: 'build', text: 'hi' })).nodes.build.stream.lines.length, 1);
});
