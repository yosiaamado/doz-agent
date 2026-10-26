import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduceStreamEvent, toRunResult } from '../server/runners/stream.js';
import { reduceStreamEvent as reExported } from '../server/runners/claude-cli.js';
import { WorkflowRun } from '../server/domain/engine.js';
import { normalize } from '../server/domain/workflow.js';

function feed(events, opts = {}) {
  const activities = [];
  const limits = [];
  let state;
  for (const ev of events) state = reduceStreamEvent(state, ev, { workdir: '/w', onActivity: (a) => activities.push(a), onRateLimit: (i) => limits.push(i), ...opts });
  return { activities, limits, state };
}

const assistant = (content, parent = null, id = `m${Math.random()}`) => ({ type: 'assistant', parent_tool_use_id: parent, message: { id, content } });
const toolUse = (id, name, input = {}) => ({ type: 'tool_use', id, name, input });
const toolResult = (id, content = 'ok', isError = false, parent = null) => ({ type: 'user', parent_tool_use_id: parent, message: { content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] } });

test('stream: claude-cli keeps re-exporting the reducer', () => {
  assert.equal(reExported, reduceStreamEvent);
});

test('stream: subagent events are nested under their Task call', () => {
  const { activities } = feed([
    assistant([toolUse('t1', 'Task', { subagent_type: 'qa-tester', description: 'Run QA' })]),
    assistant([toolUse('r1', 'Read', { file_path: '/w/a.js' })], 't1'),
    toolResult('t1', 'all good'),
  ]);
  assert.deepEqual(activities.map((a) => [a.kind, a.toolUseId, a.parentId]), [['subagent_start', 't1', null], ['tool', 'r1', 't1'], ['subagent_end', 't1', null]]);
  assert.equal(activities[0].agent, 'qa-tester');
  assert.equal(activities[0].text, 'qa-tester: Run QA');
  assert.equal(activities[1].tool, 'Read');
  assert.equal(activities[1].text, 'Read: a.js');
  assert.equal(activities[2].isError, false);
});

test('stream: two parallel Task calls keep their own children', () => {
  const { activities } = feed([
    assistant([toolUse('t1', 'Task', { subagent_type: 'a' }), toolUse('t2', 'Task', { subagent_type: 'b' })]),
    assistant([toolUse('x1', 'Read', { file_path: 'f1' })], 't1'),
    assistant([toolUse('x2', 'Grep', { pattern: 'p' })], 't2'),
    assistant([toolUse('x3', 'Read', { file_path: 'f3' })], 't1'),
    toolResult('x2', 'boom', true, 't2'),
    toolResult('t2', 'done'),
    toolResult('t1', 'done'),
  ]);
  const parentOf = (id) => activities.find((a) => a.toolUseId === id && a.kind === 'tool')?.parentId;
  assert.deepEqual([parentOf('x1'), parentOf('x2'), parentOf('x3')], ['t1', 't2', 't1']);
  const err = activities.find((a) => a.kind === 'tool_error');
  assert.equal(err.parentId, 't2');
  assert.equal(err.tool, 'Grep');
  assert.deepEqual(activities.filter((a) => a.kind === 'subagent_end').map((a) => a.toolUseId), ['t2', 't1']);
});

test('stream: a nested subagent end carries the parent of its own call, and a tool error without ev parent falls back to the remembered one', () => {
  const { activities } = feed([
    assistant([toolUse('t1', 'Task', {})]),
    assistant([toolUse('t2', 'Agent', {})], 't1'),
    assistant([toolUse('x', 'Bash', { command: 'ls' })], 't2'),
    toolResult('x', 'nope', true),
    toolResult('t2', 'done'),
  ]);
  assert.equal(activities[1].agent, 'general-purpose');
  assert.equal(activities.find((a) => a.kind === 'tool_error').parentId, 't2');
  assert.equal(activities.find((a) => a.kind === 'subagent_end').parentId, 't1');
});

test('stream: Agent tool name is treated like Task', () => {
  const { activities } = feed([assistant([toolUse('t9', 'Agent', { prompt: 'x'.repeat(300) })])]);
  assert.equal(activities[0].kind, 'subagent_start');
  assert.equal(activities[0].text.length, 'general-purpose: '.length + 120);
});

test('stream: Skill, TodoWrite, init and rate limit', () => {
  const todos = [{ content: 'a', status: 'completed', activeForm: 'A' }, { content: 'b', status: 'pending' }, { content: 'c', status: 'pending' }];
  const { activities, limits, state } = feed([
    { type: 'system', subtype: 'init', model: 'm1', session_id: 'sess-1', apiKeySource: 'none', permissionMode: 'default', cwd: '/w', tools: ['a', 'b'], mcp_servers: [{ name: 'gh', status: 'failed', extra: 1 }] },
    assistant([toolUse('s1', 'Skill', { skill: 'doz-agent:fe-base' }), toolUse('w1', 'TodoWrite', { todos })]),
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour' } },
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed_warning', rateLimitType: 'five_hour', resetsAt: 1761480000, utilization: 0.83, isUsingOverage: false } },
  ]);
  const by = (kind) => activities.filter((a) => a.kind === kind);
  assert.equal(by('init')[0].init.mcpServers[0].status, 'failed');
  assert.deepEqual(by('init')[0].init.mcpServers[0], { name: 'gh', status: 'failed' });
  assert.equal(by('init')[0].init.apiKeySource, 'none');
  assert.equal(by('init')[0].init.tools, 2);
  assert.equal(by('init')[0].session, 'sess-1');
  assert.equal(state.sessionId, 'sess-1');
  assert.equal(by('skill')[0].skill, 'doz-agent:fe-base');
  assert.equal(by('skill')[0].text, 'Skill: doz-agent:fe-base');
  assert.equal(by('todo')[0].text, 'Todo 1/3');
  assert.equal(by('todo')[0].todos.length, 3);
  assert.equal(limits.length, 2, 'onRateLimit is always called');
  assert.equal(by('rate_limit').length, 1, 'only the non-allowed status becomes an activity');
  assert.deepEqual(Object.keys(by('rate_limit')[0].rateLimit).sort(), ['rateLimitType', 'resetsAt', 'status', 'utilization']);
});

test('stream: permission denial becomes blocked', () => {
  const { activities } = feed([
    assistant([toolUse('w1', 'Write', { file_path: '/w/a.txt' })]),
    toolResult('w1', "Claude requested permissions to use Write, but you haven't granted it yet.", true),
    { type: 'result', subtype: 'success', result: 'r', total_cost_usd: 0, usage: {}, permission_denials: [{ tool_name: 'Write', tool_use_id: 'w1' }, { tool_name: 'Edit', tool_use_id: 'x' }] },
  ]);
  const blocked = activities.filter((a) => a.kind === 'blocked');
  assert.deepEqual(blocked.map((a) => [a.tool, a.toolUseId]), [['Write', 'w1'], ['Edit', 'x']]);
  assert.equal(activities.some((a) => a.kind === 'tool_error'), false);
});

test('stream: lastText ignores subagent text', () => {
  const { state } = feed([
    assistant([{ type: 'text', text: 'A' }]),
    assistant([{ type: 'text', text: 'B' }], 't1'),
    { type: 'system', subtype: 'init', session_id: 's9' },
    { type: 'result', subtype: 'success', total_cost_usd: 0, usage: {} },
  ]);
  const res = toRunResult(state);
  assert.equal(res.output, 'A');
  assert.equal(res.sessionId, 's9');
});

test('stream: usage still counts nested messages once per id', () => {
  const usages = [];
  feed([
    { type: 'assistant', parent_tool_use_id: 't1', message: { id: 'a', usage: { input_tokens: 5, output_tokens: 1 }, content: [] } },
    { type: 'assistant', parent_tool_use_id: null, message: { id: 'a', usage: { input_tokens: 5, output_tokens: 1 }, content: [] } },
  ], { onUsage: (u) => usages.push(u) });
  assert.deepEqual(usages.at(-1), { input: 5, output: 1, cacheRead: 0, cacheWrite: 0 });
});

test('engine: running node event carries agent, label and next', async () => {
  const events = [];
  const wf = normalize({
    name: 'w',
    nodes: [{ id: 'a', type: 'agent', agent: 'x', label: 'First' }, { id: 'b', type: 'agent', agent: 'x', label: 'Second' }],
    edges: [{ from: 'a', to: 'b' }],
  });
  const runner = { describe: () => 'cmd', run: async () => ({ output: 'ok', cost: 0 }) };
  const run = new WorkflowRun({
    id: 't', wf, agents: [{ name: 'x', description: 'd', tools: ['Read'], model: 'sonnet', prompt: 'p' }], actions: [], input: 'go', workdir: '.',
    runners: { 'claude-cli': runner, api: runner }, emit: (e) => events.push(e),
  });
  await run.start();
  const first = events.find((e) => e.type === 'node' && e.node === 'a' && e.status === 'running');
  assert.equal(first.agent, 'x');
  assert.equal(first.label, 'First');
  assert.deepEqual(first.next, [{ id: 'b', label: 'Second' }]);
  const last = events.find((e) => e.type === 'node' && e.node === 'b' && e.status === 'running');
  assert.deepEqual(last.next, []);
});
