import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../web/src/i18n/index.js';
import { ApiRequestError, api } from '../web/src/lib/api.js';
import { errorMessage } from '../web/src/lib/errorMessage.js';
import { subscribe, subscribeStatus, getStatus } from '../web/src/lib/events.js';
import { applyDetail, applyList, applyResponse, emptyChats, reduceChat } from '../web/src/hooks/useChats.js';

const tEn = (k, v) => translate('en', k, v);
const tId = (k, v) => translate('id', k, v);

const chat = (extra = {}) => ({ id: 'c_9f3a1b2c', agent: 'technical-lead', title: '', profileId: 'default', configDir: null, workdir: '/w', allowEdits: false, sessionId: null, status: 'idle', turns: 0, cost: 0, createdAt: 1, updatedAt: 1, ...extra });
const socket = (event) => ({ type: 'chat', event });
const user = (turn, text = 'hi', extra = {}) => ({ id: `c_9f3a1b2c:${turn}:user`, turn, role: 'user', text, ts: turn, ...extra });
const opened = () => applyDetail(emptyChats(), { chat: chat(), messages: [], activity: [] });

test('web chats: reducing chat events', () => {
  let s = reduceChat(opened(), socket({ type: 'chat_turn_start', chat: 'c_9f3a1b2c', turn: 1, ts: 5, message: user(1) }));
  assert.equal(s.chats[0].status, 'running');
  assert.deepEqual(s.details.c_9f3a1b2c.messages.map((m) => m.role), ['user']);

  s = reduceChat(s, socket({ type: 'activity', chat: 'c_9f3a1b2c', turn: 1, kind: 'tool', text: 'Read: a.js', ts: 6 }));
  assert.equal(s.details.c_9f3a1b2c.stream.current, 'Read: a.js');

  const error = { id: 'c_9f3a1b2c:1:error', turn: 1, role: 'error', text: 'claude exited with code 1', ts: 7, errorCode: 'CHAT_TURN_FAILED' };
  s = reduceChat(s, socket({ type: 'chat_turn_end', chat: 'c_9f3a1b2c', turn: 1, ts: 7, status: 'failed', message: error, cost: 0, usage: null, sessionId: null }));
  assert.equal(s.chats[0].status, 'failed');
  assert.equal(s.details.c_9f3a1b2c.messages.at(-1).role, 'error');
  assert.equal(s.chats[0].turns, 1);
});

test('web chats: a finished turn updates cost, turns and session; the same message is never added twice', () => {
  let s = reduceChat(opened(), socket({ type: 'chat_turn_start', chat: 'c_9f3a1b2c', turn: 1, ts: 5, message: user(1) }));
  const done = { type: 'chat_turn_end', chat: 'c_9f3a1b2c', turn: 1, ts: 9, status: 'done', message: { id: 'c_9f3a1b2c:1:assistant', turn: 1, role: 'assistant', text: 'hello', ts: 9, cost: 0.5 }, cost: 0.5, sessionId: 's1' };
  s = reduceChat(reduceChat(s, socket(done)), socket(done));
  assert.equal(s.chats[0].status, 'idle');
  assert.equal(s.chats[0].sessionId, 's1');
  assert.equal(s.chats[0].cost, 0.5);
  assert.equal(s.details.c_9f3a1b2c.messages.length, 2);
});

test('web chats: a retry shows a marker message and a new running turn, with a fresh stream', () => {
  let s = reduceChat(opened(), socket({ type: 'chat_turn_start', chat: 'c_9f3a1b2c', turn: 1, ts: 5, message: user(1) }));
  s = reduceChat(s, socket({ type: 'activity', chat: 'c_9f3a1b2c', turn: 1, kind: 'tool', text: 'old', ts: 6 }));
  s = reduceChat(s, socket({ type: 'chat_turn_end', chat: 'c_9f3a1b2c', turn: 1, ts: 7, status: 'failed', message: { id: 'c_9f3a1b2c:1:error', turn: 1, role: 'error', text: 'x', ts: 7, errorCode: 'CHAT_TURN_FAILED' } }));
  s = reduceChat(s, socket({ type: 'chat_turn_start', chat: 'c_9f3a1b2c', turn: 2, ts: 8, message: user(2, 'hi', { retryOf: 1 }) }));
  assert.equal(s.chats[0].status, 'running');
  assert.equal(s.details.c_9f3a1b2c.messages.at(-1).retryOf, 1);
  assert.equal(s.details.c_9f3a1b2c.stream.lines.length, 0);
});

test('web chats: a chat that was never opened gets no partial history; created, updated and deleted events', () => {
  let s = reduceChat(emptyChats(), socket({ type: 'chat_created', chat: chat() }));
  assert.deepEqual(s.details.c_9f3a1b2c.messages, []);
  s = applyList(emptyChats(), [chat({ id: 'c_00000001' })]);
  s = reduceChat(s, socket({ type: 'chat_turn_start', chat: 'c_00000001', turn: 1, ts: 5, message: user(1) }));
  assert.equal(s.chats[0].status, 'running');
  assert.equal(s.details.c_00000001, undefined, 'no details → no partial messages');
  assert.equal(reduceChat(s, socket({ type: 'chat_turn_start', chat: 'c_unknown', turn: 1, ts: 1, message: user(1) })).chats.length, 1);
  s = reduceChat(s, socket({ type: 'chat_updated', chat: chat({ id: 'c_00000001', allowEdits: true, updatedAt: 99 }) }));
  assert.equal(s.chats[0].allowEdits, true);
  s = reduceChat(s, socket({ type: 'chat_deleted', chat: 'c_00000001' }));
  assert.equal(s.chats.length, 0);
  assert.equal(reduceChat(s, { type: 'event', event: {} }), s, 'run events are ignored');
});

test('web chats: lists are newest first and a refetched list drops details of removed chats', () => {
  let s = applyList(emptyChats(), [chat({ id: 'c_00000001', updatedAt: 1 }), chat({ id: 'c_00000002', updatedAt: 9 })]);
  assert.deepEqual(s.chats.map((c) => c.id), ['c_00000002', 'c_00000001']);
  s = applyDetail(s, { chat: chat({ id: 'c_00000001', updatedAt: 1 }), messages: [user(1)], activity: [{ kind: 'tool', text: 'Read: a' }] });
  assert.equal(s.details.c_00000001.stream.lines.length, 1);
  s = applyList(s, [chat({ id: 'c_00000002', updatedAt: 9 })]);
  assert.equal(s.details.c_00000001, undefined);
});

test('web chats: cost sums across turns with the real event ordering', () => {
  let s = reduceChat(opened(), socket({ type: 'chat_turn_start', chat: 'c_9f3a1b2c', turn: 1, ts: 5, message: user(1) }));
  s = reduceChat(s, socket({ type: 'chat_updated', chat: chat({ id: 'c_9f3a1b2c', status: 'running', turns: 1, sessionId: 's1', updatedAt: 5 }) }));
  const end = (turn, cost, ts) => socket({ type: 'chat_turn_end', chat: 'c_9f3a1b2c', turn, ts, status: 'done', cost, message: null });
  s = reduceChat(s, end(1, 0.5, 6));
  s = reduceChat(s, end(1, 0.5, 6));
  s = reduceChat(s, socket({ type: 'chat_turn_start', chat: 'c_9f3a1b2c', turn: 2, ts: 7, message: user(2) }));
  s = reduceChat(s, end(2, 0.25, 8));
  assert.equal(s.chats[0].cost, 0.75);
  assert.equal(s.chats[0].turns, 2);
});

test('web chats: a late POST response never overwrites newer socket state', () => {
  let s = reduceChat(opened(), socket({ type: 'chat_turn_start', chat: 'c_9f3a1b2c', turn: 1, ts: 5, message: user(1) }));
  s = reduceChat(s, socket({ type: 'chat_turn_end', chat: 'c_9f3a1b2c', turn: 1, ts: 7, status: 'failed', cost: 0, message: null }));
  s = applyResponse(s, chat({ id: 'c_9f3a1b2c', status: 'running', turns: 1, updatedAt: 5 }));
  assert.equal(s.chats[0].status, 'failed');
  s = applyResponse(s, chat({ id: 'c_9f3a1b2c', status: 'running', turns: 2, updatedAt: 9 }));
  assert.equal(s.chats[0].status, 'running', 'a genuinely newer response still applies');
});

test('web chats: streams are kept for chats that were never opened', () => {
  let s = applyList(emptyChats(), [chat({ id: 'c_00000001', agent: 'qa-tester' })]);
  s = reduceChat(s, socket({ type: 'activity', chat: 'c_00000001', kind: 'tool', text: 'Read: a.js' }));
  assert.equal(s.details.c_00000001, undefined);
  assert.equal(s.streams.c_00000001.current, 'Read: a.js');
  s = reduceChat(s, socket({ type: 'chat_deleted', chat: 'c_00000001' }));
  assert.equal(s.streams.c_00000001, undefined);
});

async function withFetch(impl, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return impl(url, init); };
  try { await fn(calls); } finally { globalThis.fetch = original; }
}

test('web chats api: method, url and body match the contract', async () => {
  await withFetch(() => ({ json: async () => ({ success: true, data: {} }) }), async (calls) => {
    await api.chats();
    await api.chat('c_9f3a1b2c');
    await api.createChat('technical-lead');
    await api.createChat('qa-tester', true);
    await api.sendChat('c_9f3a1b2c', 'hello');
    await api.retryChat('c_9f3a1b2c');
    await api.updateChat('c_9f3a1b2c', { allowEdits: false });
    await api.deleteChat('c_9f3a1b2c');
    assert.deepEqual(calls.map((c) => [c.init.method, c.url]), [
      ['GET', '/api/chats'], ['GET', '/api/chats/c_9f3a1b2c'], ['POST', '/api/chats'], ['POST', '/api/chats'],
      ['POST', '/api/chats/c_9f3a1b2c/messages'], ['POST', '/api/chats/c_9f3a1b2c/retry'], ['PUT', '/api/chats/c_9f3a1b2c'], ['DELETE', '/api/chats/c_9f3a1b2c'],
    ]);
    assert.deepEqual(JSON.parse(calls[2].init.body), { agent: 'technical-lead', allowEdits: false });
    assert.deepEqual(JSON.parse(calls[3].init.body), { agent: 'qa-tester', allowEdits: true });
    assert.deepEqual(JSON.parse(calls[4].init.body), { text: 'hello' });
    assert.deepEqual(JSON.parse(calls[6].init.body), { allowEdits: false });
  });
});

test('web chats errors: every S3 code is translated in en and id', () => {
  const codes = {
    CHAT_AGENT_NOT_FOUND: { agent: 'x' }, CHAT_NOT_FOUND: {}, CHAT_MESSAGE_EMPTY: {}, CHAT_TURN_ACTIVE: {}, CHAT_PROFILE_GONE: {},
    CHAT_NOTHING_TO_RETRY: {}, CHAT_TURN_FAILED: {}, CHAT_INTERRUPTED: {},
  };
  for (const [code, params] of Object.entries(codes)) {
    for (const t of [tEn, tId]) {
      const text = errorMessage(t, new ApiRequestError('english fallback', { code, params }));
      assert.notEqual(text, 'english fallback', code);
      assert.ok(!text.includes('{'), text);
    }
  }
});

class FakeSocket {
  static all = [];
  constructor() { FakeSocket.all.push(this); this.closed = false; }
  close() { this.closed = true; }
}

test('web events: one shared socket for all subscribers, status is reported, it closes with the last subscriber', () => {
  const originalWs = globalThis.WebSocket;
  const originalLocation = globalThis.location;
  globalThis.WebSocket = FakeSocket;
  globalThis.location = { protocol: 'http:', host: 'localhost:4317' };
  FakeSocket.all = [];
  try {
    const a = [];
    const b = [];
    const statuses = [];
    const offA = subscribe((m) => a.push(m));
    const offB = subscribe((m) => { if (m.type === 'boom') throw new Error('x'); b.push(m); });
    const offStatus = subscribeStatus((s) => statuses.push(s));
    assert.equal(FakeSocket.all.length, 1);
    assert.equal(getStatus(), 'reconnecting');

    const ws = FakeSocket.all[0];
    ws.onopen();
    ws.onmessage({ data: JSON.stringify({ type: 'boom' }) });
    ws.onmessage({ data: JSON.stringify({ type: 'profiles' }) });
    ws.onmessage({ data: 'not json' });
    assert.equal(getStatus(), 'open');
    assert.deepEqual(a.map((m) => m.type), ['boom', 'profiles']);
    assert.deepEqual(b.map((m) => m.type), ['profiles'], 'a throwing subscriber does not starve the others');

    offA();
    assert.equal(ws.closed, false);
    offB();
    offStatus();
    assert.equal(ws.closed, true);
    assert.deepEqual(statuses, ['open']);
    assert.equal(getStatus(), 'reconnecting');

    const offAgain = subscribe(() => {});
    assert.equal(FakeSocket.all.length, 2, 'a new subscriber after a full release opens a fresh socket');
    offAgain();
  } finally {
    globalThis.WebSocket = originalWs;
    globalThis.location = originalLocation;
  }
});
