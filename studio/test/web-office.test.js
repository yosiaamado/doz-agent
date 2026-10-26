import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveOffice, defaultChatAgent } from '../web/src/lib/office.js';
import { emptyActivity } from '../web/src/lib/activity.js';

const agent = (name) => ({ name, description: `${name} agent` });

test('office: technical-lead pinned first, default chat target', () => {
  const agents = [agent('qa-tester'), agent('backend-engineer'), agent('technical-lead')];
  const roster = deriveOffice({ agents, run: null, chats: [] });
  assert.deepEqual(roster.map((a) => a.name), ['technical-lead', 'backend-engineer', 'qa-tester']);
  assert.deepEqual(roster.map((a) => a.pinned), [true, false, false]);
  assert.equal(defaultChatAgent(agents), 'technical-lead');
  assert.equal(defaultChatAgent([agent('qa-tester'), agent('backend-engineer')]), 'backend-engineer');
});

test('office: status from run and chats', () => {
  const agents = [agent('backend-engineer'), agent('qa-tester'), agent('technical-lead')];
  const stream = { ...emptyActivity(), current: 'Edit: a.js', todos: [{ content: 'x', status: 'pending' }] };
  const run = {
    id: 'r1', status: 'running', order: ['build'],
    nodes: { build: { agent: 'backend-engineer', status: 'running', label: 'Build', stream, next: [{ id: 'review', label: 'Review' }] } },
  };
  const chats = [{ id: 'c_1', agent: 'qa-tester', status: 'running', updatedAt: 2 }];
  const by = Object.fromEntries(deriveOffice({ agents, run, chats }).map((a) => [a.name, a]));
  assert.equal(by['backend-engineer'].status, 'running');
  assert.equal(by['backend-engineer'].node.label, 'Build');
  assert.equal(by['backend-engineer'].activity, 'Edit: a.js');
  assert.equal(by['backend-engineer'].next[0].label, 'Review');
  assert.equal(by['backend-engineer'].todos.length, 1);
  assert.equal(by['qa-tester'].status, 'chatting');
  assert.equal(by['qa-tester'].chatId, 'c_1');
  assert.equal(by['technical-lead'].status, 'idle');

  const done = deriveOffice({ agents, run: { ...run, status: 'done' }, chats: [] });
  assert.ok(done.every((a) => a.status === 'idle' && a.node === null));
});

test('office: running wins over chatting and keeps the chat id; chat stream feeds the activity line', () => {
  const agents = [agent('backend-engineer'), agent('qa-tester')];
  const run = { id: 'r1', status: 'running', order: ['n'], nodes: { n: { agent: 'qa-tester', status: 'running', stream: emptyActivity() } } };
  const chats = { chats: [{ id: 'c_2', agent: 'qa-tester', status: 'running', updatedAt: 1 }, { id: 'c_3', agent: 'backend-engineer', status: 'running', updatedAt: 1 }], selected: { chat: { id: 'c_3' }, stream: { ...emptyActivity(), current: 'Read: x' } } };
  const by = Object.fromEntries(deriveOffice({ agents, run, chats }).map((a) => [a.name, a]));
  assert.equal(by['qa-tester'].status, 'running');
  assert.equal(by['qa-tester'].chatId, 'c_2');
  assert.equal(by['backend-engineer'].status, 'chatting');
  assert.equal(by['backend-engineer'].activity, 'Read: x');
});

test('office: a non-selected running chat still feeds the activity line', () => {
  const chats = {
    chats: [{ id: 'c_a', agent: 'qa-tester', status: 'running', updatedAt: 1 }], selectedId: 'c_other', selected: null,
    streams: { c_a: { ...emptyActivity(), current: 'Grep: todo' } },
  };
  const qa = deriveOffice({ agents: [agent('qa-tester')], run: null, chats })[0];
  assert.equal(qa.status, 'chatting');
  assert.equal(qa.activity, 'Grep: todo');
});

test('office: the selected chat of an agent wins over its running chat, and status still reflects the running one', () => {
  const chats = {
    chats: [{ id: 'c_new', agent: 'qa-tester', status: 'idle', updatedAt: 5 }, { id: 'c_run', agent: 'qa-tester', status: 'running', updatedAt: 4 }],
    selectedId: 'c_new', streams: {},
  };
  const qa = deriveOffice({ agents: [agent('qa-tester')], run: null, chats })[0];
  assert.equal(qa.chatId, 'c_new');
  assert.equal(qa.status, 'chatting');
});
