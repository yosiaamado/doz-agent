import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConfigStore } from '../server/infra/configStore.js';
import { createProfileStore, migrateProfiles } from '../server/infra/profileStore.js';
import { createProfileService } from '../server/services/profileService.js';
import { createChatService } from '../server/services/chatService.js';
import { ChatRegistry } from '../server/repositories/chatRepository.js';
import { buildChatArgs, chatAgentDefinition, createClaudeCliRunner } from '../server/runners/claude-cli.js';
import { registerChatRoutes } from '../server/routes/chatRoutes.js';
import { Router } from '../server/http/router.js';
import { makeEnvironment, rejectsWith } from '../tests/updateFixture.js';

const tempDir = (name = 'doz-chat-') => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), name)));
const quiet = { info() {}, warn() {}, error() {} };
const code = (c) => (e) => e.code === c;
const AGENT = { name: 'lead', description: 'Leads', prompt: 'Be the lead', tools: ['Read', 'Edit', 'Write', 'Bash', 'Task'], shadowed: false };
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SID = '11111111-2222-4333-8444-555555555555';
const after = async (fn) => { await new Promise((r) => setImmediate(r)); return fn(); };

// runner.chat is a fake: each call is recorded; `script(opts, calls)` returns a promise or throws.
function fixture({ script = async () => ({ output: 'ok', cost: 0.01, usage: null, sessionId: null }), agents = [AGENT] } = {}) {
  const home = tempDir('doz-home-');
  const workdir = tempDir('doz-work-');
  const store = createConfigStore(path.join(tempDir(), 'config.json'));
  migrateProfiles(store, quiet);
  const profileStore = createProfileStore({ store, codec: null, logger: quiet });
  const messages = [];
  let chats;
  let chatRepo;
  const profiles = createProfileService({ store: profileStore, broadcast: () => {}, isBusy: () => chats.hasActive(), isInUse: (id) => chatRepo.references(id), env: {}, homedir: home });
  chatRepo = new ChatRegistry({ broadcast: (m) => messages.push(m), isActive: (id) => chats.isActive(id), hasProfile: (id) => Boolean(profileStore.get(id)) });
  const chatsDir = path.join(workdir, '.doz-studio', 'chats');
  chatRepo.watch(chatsDir);
  const calls = [];
  const runner = { chat: (opts) => { calls.push(opts); return script(opts, calls); } };
  const config = { getWorkdir: () => workdir };
  const components = { list: () => agents };
  chats = createChatService({ config, components, profiles, chatRepo, runner });
  return { home, workdir, chatsDir, chats, chatRepo, profiles, messages, calls, events: () => messages.filter((m) => m.type === 'chat').map((m) => m.event) };
}

test('chat args: first turn uses --session-id, follow-up uses --resume', () => {
  const first = buildChatArgs({ agent: AGENT, sessionId: null, resume: false, allowEdits: false }, { pluginDir: '/p', agentsFile: 'a.json' });
  assert.match(first[first.indexOf('--session-id') + 1], UUID_V4);
  assert.equal(first.includes('--resume'), false);
  assert.equal(first[first.indexOf('--disallowedTools') + 1].split(',').includes('Task'), true);
  assert.equal(first[first.indexOf('--agent') + 1], 'lead');
  assert.equal(first[first.indexOf('--plugin-dir') + 1], '/p');
  const again = buildChatArgs({ agent: AGENT, sessionId: SID, resume: true, allowEdits: false }, { agentsFile: 'a.json' });
  assert.equal(again[again.indexOf('--resume') + 1], SID);
  assert.equal(again.includes('--session-id'), false);
  const retry = buildChatArgs({ agent: AGENT, sessionId: null, resume: false, allowEdits: false }, {});
  assert.notEqual(retry[retry.indexOf('--session-id') + 1], first[first.indexOf('--session-id') + 1]);
});

test('chat args: read-only has no write, Bash, web or subagent tool and an explicit mode (SEC-1, SEC-2, D-A)', () => {
  const ro = buildChatArgs({ agent: AGENT, sessionId: null, resume: false, allowEdits: false }, {});
  const allowed = ro[ro.indexOf('--allowedTools') + 1].split(',');
  assert.deepEqual(allowed, ['Read']);
  assert.equal(ro.join(' ').includes('Bash('), false);
  const denied = ro[ro.indexOf('--disallowedTools') + 1].split(',');
  for (const t of ['Task', 'Agent', 'Edit', 'Write', 'NotebookEdit', 'MultiEdit', 'Bash', 'WebFetch', 'WebSearch']) assert.ok(denied.includes(t), t);
  assert.equal(ro[ro.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.equal(ro[ro.indexOf('--setting-sources') + 1], 'user');
  assert.ok(ro.includes('--strict-mcp-config'));
  assert.deepEqual(chatAgentDefinition(AGENT).lead.tools, ['Read']);
});

test('chat args: allow-edits gets the edit tools only, never Bash or web tools', () => {
  const rw = buildChatArgs({ agent: AGENT, sessionId: null, resume: false, allowEdits: true }, {});
  assert.equal(rw[rw.indexOf('--allowedTools') + 1], 'Read,Edit,Write');
  assert.equal(rw[rw.indexOf('--permission-mode') + 1], 'acceptEdits');
  const denied = rw[rw.indexOf('--disallowedTools') + 1].split(',');
  for (const tool of ['Bash', 'WebFetch', 'WebSearch']) assert.ok(denied.includes(tool), tool);
  assert.deepEqual(chatAgentDefinition(AGENT, true).lead.tools, ['Read', 'Edit', 'Write']);
  const web = { ...AGENT, tools: ['Read', 'WebFetch', 'Edit'] };
  assert.deepEqual(chatAgentDefinition(web, true).lead.tools, ['Read', 'Edit']);
});

test('chat: a watch mid-turn keeps the running chat and does not interrupt it (CR-1)', async () => {
  let release;
  let emit;
  const f = fixture({ script: (opts) => { emit = opts.onActivity; return new Promise((r) => { release = r; }); } });
  const chat = f.chats.create({ agent: 'lead' });
  f.chats.send(chat.id, { text: 'hello' });
  const other = tempDir('doz-other-');
  f.chatRepo.watch(path.join(other, '.doz-studio', 'chats'));
  assert.doesNotThrow(() => emit({ kind: 'text', text: 'late' }));
  f.chatRepo.watch(f.chatsDir);
  f.chatRepo.watch(f.chatsDir);
  assert.doesNotThrow(() => emit({ kind: 'text', text: 'later' }));
  release({ output: 'done', cost: 0, usage: null, sessionId: null });
  await after(() => {});
  const lines = fs.readFileSync(path.join(f.chatsDir, `${chat.id}.jsonl`), 'utf8').trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
  assert.deepEqual(lines.filter((l) => l.type === 'chat_turn_end').map((l) => l.status), ['done']);
  assert.equal(f.chatRepo.get(chat.id).status, 'idle');
});

test('chat: an activity for a deleted chat is dropped, not thrown (CR-1)', () => {
  let emit;
  const f = fixture({ script: (opts) => { emit = opts.onActivity; return new Promise(() => {}); } });
  const chat = f.chats.create({ agent: 'lead' });
  f.chats.send(chat.id, { text: 'hello' });
  f.chatRepo.remove(chat.id);
  assert.doesNotThrow(() => emit({ kind: 'text', text: 'x' }));
});

test('chat: a failed turn-start write does not leave the chat locked (CR-2)', () => {
  const f = fixture({ script: () => new Promise(() => {}) });
  const chat = f.chats.create({ agent: 'lead' });
  const real = f.chatRepo.append.bind(f.chatRepo);
  f.chatRepo.append = (id, ev, p) => { if (ev.type === 'chat_turn_start') throw new Error('disk full'); return real(id, ev, p); };
  assert.throws(() => f.chats.send(chat.id, { text: 'hi' }), /disk full/);
  assert.equal(f.chats.hasActive(), false);
});

test('chat: a failing turn-end write is contained (CR-3)', async () => {
  const f = fixture();
  const chat = f.chats.create({ agent: 'lead' });
  const real = f.chatRepo.append.bind(f.chatRepo);
  f.chatRepo.append = (id, ev, p) => { if (ev.type === 'chat_turn_end') throw new Error('EBUSY'); return real(id, ev, p); };
  const rejections = [];
  const onRejection = (e) => rejections.push(e);
  process.on('unhandledRejection', onRejection);
  f.chats.send(chat.id, { text: 'hi' });
  await after(() => new Promise((r) => setTimeout(r, 20)));
  process.off('unhandledRejection', onRejection);
  assert.deepEqual(rejections, []);
  assert.equal(f.chats.hasActive(), false);
});

test('chat: a planted chat file cannot grant edits, a session or a foreign profile (SEC-5)', () => {
  const f = fixture();
  const id = 'c_deadbeef';
  const planted = [
    { type: 'chat_created', ts: 1, chat: { id, agent: 'lead', title: 't', profileId: 'p_nope', configDir: null, workdir: '/etc', allowEdits: true, sessionId: 'x" & calc', status: 'idle', turns: 0, cost: 0, createdAt: 1, updatedAt: 1 } },
  ];
  fs.writeFileSync(path.join(f.chatsDir, `${id}.jsonl`), planted.map((l) => JSON.stringify(l)).join(String.fromCharCode(10)) + String.fromCharCode(10));
  f.chatRepo.watch(f.chatsDir);
  const got = f.chatRepo.get(id);
  assert.equal(got.allowEdits, false);
  assert.equal(got.sessionId, null);
  assert.equal(got.profileId, null);
  assert.equal(got.workdir, f.workdir);
});

test('chat: a non-UUID session id reported by the CLI is not stored (SEC-5)', () => {
  let emit;
  const f = fixture({ script: (opts) => { emit = opts.onActivity; return new Promise(() => {}); } });
  const chat = f.chats.create({ agent: 'lead' });
  f.chats.send(chat.id, { text: 'hi' });
  emit({ kind: 'init', text: 'm', init: { sessionId: 'x" & calc' } });
  assert.equal(f.chatRepo.get(chat.id).sessionId, null);
  emit({ kind: 'init', text: 'm', init: { sessionId: SID } });
  assert.equal(f.chatRepo.get(chat.id).sessionId, SID);
});

test('chat: re-pointing a profile folder that chats use is 409 PROFILE_IN_USE (D-B)', () => {
  const f = fixture();
  const work = f.profiles.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  const spare = f.profiles.create({ name: 'Spare', configDir: path.join(f.home, '.sp') });
  f.profiles.setActive(work.id);
  f.chats.create({ agent: 'lead' });
  assert.throws(() => f.profiles.update(work.id, { configDir: path.join(f.home, '.cw2') }), (e) => e.status === 409 && e.code === 'PROFILE_IN_USE');
  assert.equal(f.profiles.update(work.id, { name: 'Renamed' }).name, 'Renamed');
  assert.equal(f.profiles.update(spare.id, { configDir: path.join(f.home, '.sp2') }).configDir, path.join(f.home, '.sp2'));
});
test('chat: create with unknown agent is 404', () => {
  const f = fixture();
  assert.throws(() => f.chats.create({ agent: 'nope' }), (e) => e.status === 404 && e.code === 'CHAT_AGENT_NOT_FOUND' && e.params.agent === 'nope');
  const shadowed = fixture({ agents: [{ ...AGENT, shadowed: true }] });
  assert.throws(() => shadowed.chats.create({ agent: 'lead' }), code('CHAT_AGENT_NOT_FOUND'));
});

test('chat: empty message is 400', () => {
  const f = fixture();
  const chat = f.chats.create({ agent: 'lead' });
  const file = path.join(f.chatsDir, `${chat.id}.jsonl`);
  const before = fs.readFileSync(file, 'utf8');
  assert.throws(() => f.chats.send(chat.id, { text: '   \n' }), (e) => e.status === 400 && e.code === 'CHAT_MESSAGE_EMPTY');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(f.calls.length, 0);
});

test('chat: second send while running is 409', async () => {
  const f = fixture({ script: () => new Promise(() => {}) });
  const chat = f.chats.create({ agent: 'lead' });
  f.chats.send(chat.id, { text: 'one' });
  assert.throws(() => f.chats.send(chat.id, { text: 'two' }), (e) => e.status === 409 && e.code === 'CHAT_TURN_ACTIVE');
  assert.throws(() => f.chats.retry(chat.id), code('CHAT_TURN_ACTIVE'));
  assert.throws(() => f.chats.update(chat.id, { allowEdits: true }), code('CHAT_TURN_ACTIVE'));
  assert.throws(() => f.chats.remove(chat.id), code('CHAT_TURN_ACTIVE'));
  const other = f.profiles.create({ name: 'Other', configDir: path.join(f.home, '.other') });
  assert.throws(() => f.profiles.setActive(other.id), (e) => e.status === 409 && e.code === 'PROFILE_SWITCH_BUSY');
  assert.equal(f.chats.hasActive(), true);
  assert.equal(f.calls.length, 1);
});

test('chat: turn flow persists session and messages', async () => {
  let n = 0;
  const f = fixture({
    script: async (opts) => {
      n += 1;
      if (n === 1) opts.onActivity({ kind: 'init', text: 'model m', init: { sessionId: SID } });
      return { output: n === 1 ? 'hi' : 'again', cost: 0.5, usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }, sessionId: SID };
    },
  });
  const chat = f.chats.create({ agent: 'lead' });
  const started = f.chats.send(chat.id, { text: '  Plan   the\nthing ' });
  assert.equal(started.turn, 1);
  assert.equal(started.chat.status, 'running');
  await after(() => {});
  const got = f.chats.get(chat.id);
  assert.equal(got.chat.sessionId, SID);
  assert.equal(got.chat.status, 'idle');
  assert.equal(got.chat.turns, 1);
  assert.equal(got.chat.title, 'Plan the thing');
  assert.deepEqual(got.messages.map((m) => [m.role, m.text]), [['user', '  Plan   the\nthing '], ['assistant', 'hi']]);
  assert.equal(got.activity.length, 1);
  assert.deepEqual(f.events().map((e) => e.type), ['chat_created', 'chat_turn_start', 'activity', 'chat_updated', 'chat_turn_end']);
  assert.equal(f.events().find((e) => e.type === 'activity').turn, 1);
  f.chats.send(chat.id, { text: 'more' });
  await after(() => {});
  assert.equal(f.calls[1].resume, true);
  assert.equal(f.calls[1].sessionId, SID);
  assert.equal(f.calls[0].resume, false);
  assert.equal(f.calls[0].allowEdits, false);
  assert.equal(f.chats.get(chat.id).chat.turns, 2);
  assert.equal(f.chats.get(chat.id).chat.cost, 1);
  assert.equal(f.chats.hasActive(), false);
});

test('chat: CLI failure becomes an error message and retry re-sends', async () => {
  let n = 0;
  const f = fixture({ script: async () => { n += 1; if (n === 1) throw new Error('claude exited with code 1'); return { output: 'fine', cost: 0 }; } });
  const chat = f.chats.create({ agent: 'lead' });
  assert.throws(() => f.chats.retry(chat.id), (e) => e.status === 400 && e.code === 'CHAT_NOTHING_TO_RETRY');
  f.chats.send(chat.id, { text: 'do it' });
  await after(() => {});
  let got = f.chats.get(chat.id);
  assert.equal(got.chat.status, 'failed');
  const last = got.messages.at(-1);
  assert.equal(last.role, 'error');
  assert.equal(last.errorCode, 'CHAT_TURN_FAILED');
  assert.equal(last.text, 'claude exited with code 1');
  const { turn } = f.chats.retry(chat.id);
  assert.equal(turn, 2);
  await after(() => {});
  assert.equal(f.calls[1].text, 'do it');
  const start = f.events().filter((e) => e.type === 'chat_turn_start').at(-1);
  assert.equal(start.message.retryOf, 1);
  got = f.chats.get(chat.id);
  assert.equal(got.messages.filter((m) => m.role === 'user' && !m.retryOf).length, 1);
  assert.equal(got.chat.status, 'idle');
  assert.throws(() => f.chats.retry(chat.id), code('CHAT_NOTHING_TO_RETRY'));
});

test('chat: a runner that throws synchronously still ends the turn', async () => {
  const f = fixture({ script: () => { throw new Error('spawn failed'); } });
  const chat = f.chats.create({ agent: 'lead' });
  f.chats.send(chat.id, { text: 'x' });
  await after(() => {});
  assert.equal(f.chats.get(chat.id).chat.status, 'failed');
  assert.equal(f.chats.hasActive(), false);
});

test('chat: interrupted turn after restart is failed, not stuck', async () => {
  const f = fixture({ script: () => new Promise(() => {}) });
  const chat = f.chats.create({ agent: 'lead' });
  f.chats.send(chat.id, { text: 'hello' });
  const file = path.join(f.chatsDir, `${chat.id}.jsonl`);
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.type), ['chat_created', 'chat_turn_start']);

  const revived = fixture({});
  fs.writeFileSync(path.join(revived.chatsDir, `${chat.id}.jsonl`), fs.readFileSync(file, 'utf8'));
  revived.chatRepo.watch(revived.chatsDir);
  const got = revived.chats.get(chat.id);
  assert.equal(got.chat.status, 'failed');
  assert.equal(got.messages.at(-1).errorCode, 'CHAT_INTERRUPTED');
  assert.equal(revived.chats.hasActive(), false);
  revived.chats.send(chat.id, { text: 'again' });
  assert.equal(revived.calls.length, 1);
  await after(() => {});
  const reread = new ChatRegistry({ broadcast() {} });
  reread.watch(revived.chatsDir);
  assert.equal(reread.messages(chat.id).filter((m) => m.errorCode === 'CHAT_INTERRUPTED').length, 1);
});

test('chat: a chat uses its own profile env', async () => {
  const f = fixture();
  const work = f.profiles.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  f.profiles.setActive(work.id);
  const chat = f.chats.create({ agent: 'lead' });
  assert.equal(chat.profileId, work.id);
  assert.equal(chat.configDir, work.configDir);
  f.profiles.setActive('default');
  f.chats.send(chat.id, { text: 'hi' });
  await after(() => {});
  assert.equal(f.calls[0].env.CLAUDE_CONFIG_DIR, work.configDir);
  assert.equal(f.calls[0].profileId, work.id);
  f.profiles.remove(work.id);
  assert.throws(() => f.chats.send(chat.id, { text: 'again' }), (e) => e.status === 409 && e.code === 'CHAT_PROFILE_GONE');
  assert.equal(f.chats.hasActive(), false);
  assert.equal(f.chats.get(chat.id).chat.turns, 1);
});

test('chat: delete removes only the studio record', async () => {
  const f = fixture();
  const work = f.profiles.create({ name: 'Work', configDir: path.join(f.home, '.cw') });
  f.profiles.setActive(work.id);
  const transcript = path.join(work.configDir, 'projects', 'p', 's.jsonl');
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.writeFileSync(transcript, 'keep');
  const chat = f.chats.create({ agent: 'lead' });
  const res = f.chats.remove(chat.id);
  assert.deepEqual(res, { deleted: true, transcriptKept: true, configDir: work.configDir });
  assert.equal(fs.existsSync(path.join(f.chatsDir, `${chat.id}.jsonl`)), false);
  assert.deepEqual(f.chats.list().map((c) => c.id), []);
  assert.equal(fs.readFileSync(transcript, 'utf8'), 'keep');
  assert.deepEqual(f.events().at(-1), { type: 'chat_deleted', chat: chat.id });
  assert.throws(() => f.chats.remove(chat.id), code('CHAT_NOT_FOUND'));
});

test('chat: id is validated before touching disk', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.workdir, 'x.jsonl'), '{"type":"chat_created"}');
  for (const bad of ['../x', '..\\x', 'c_ZZZZZZZZ', 'c_1234567', '']) {
    assert.throws(() => f.chats.get(bad), (e) => e.status === 404 && e.code === 'CHAT_NOT_FOUND');
  }
  assert.equal(f.chatRepo.remove('../x'), false);
  assert.equal(fs.existsSync(path.join(f.workdir, 'x.jsonl')), true);
});

test('chat: list is newest first and activity is capped on disk', () => {
  const f = fixture();
  const a = f.chats.create({ agent: 'lead' });
  const b = f.chats.create({ agent: 'lead' });
  f.chatRepo.append(a.id, { type: 'chat_updated', patch: { allowEdits: true }, ts: Date.now() + 1000 });
  assert.deepEqual(f.chats.list().map((c) => c.id), [a.id, b.id]);
  f.chatRepo.append(a.id, { type: 'chat_turn_start', chat: a.id, turn: 1, message: { id: 'm', turn: 1, role: 'user', text: 'x', ts: 1 } });
  for (let i = 0; i < 520; i++) f.chatRepo.append(a.id, { type: 'activity', chat: a.id, turn: 1, kind: 'text', text: `t${i}` });
  const onDisk = fs.readFileSync(path.join(f.chatsDir, `${a.id}.jsonl`), 'utf8').trim().split('\n').filter((l) => JSON.parse(l).type === 'activity');
  assert.equal(onDisk.length, 500);
  assert.equal(f.chats.get(a.id).activity.length, 500);
  assert.equal(f.events().filter((e) => e.type === 'activity').length, 520);
});

test('chat: routes validate the body and wire the service', async () => {
  const f = fixture();
  const router = new Router();
  registerChatRoutes(router, { chats: f.chats });
  const call = (method, url, body) => { const { handler, params } = router.resolve(method, url); return handler({ params, body }); };
  const chat = await call('POST', '/api/chats', { agent: 'lead' });
  assert.equal(chat.allowEdits, false);
  await assert.rejects(async () => call('POST', '/api/chats', {}), (e) => e.name === 'ZodError');
  await assert.rejects(async () => call('POST', `/api/chats/${chat.id}/messages`, { text: 'x'.repeat(100_001) }), (e) => e.name === 'ZodError');
  await assert.rejects(async () => call('PUT', `/api/chats/${chat.id}`, { allowEdits: 'yes' }), (e) => e.name === 'ZodError');
  assert.equal((await call('PUT', `/api/chats/${chat.id}`, { allowEdits: true })).allowEdits, true);
  assert.equal((await call('GET', '/api/chats')).length, 1);
  assert.equal((await call('GET', `/api/chats/${chat.id}`)).chat.id, chat.id);
});

test('update guard counts chats', async () => {
  const f = fixture({ script: () => new Promise(() => {}) });
  const env = makeEnvironment({ isRunActive: () => f.chats.hasActive() });
  const chat = f.chats.create({ agent: 'lead' });
  f.chats.send(chat.id, { text: 'busy' });
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_BUSY_RUN', 409);
});

function fakeClaude(script) {
  const tmp = tempDir();
  const bin = path.join(tmp, 'fake-claude.mjs');
  fs.writeFileSync(bin, script);
  const cmd = path.join(tmp, 'fake-claude.cmd');
  fs.writeFileSync(cmd, `@node "${bin}" %*\n`);
  fs.chmodSync(bin, 0o755);
  return { tmp, bin: process.platform === 'win32' ? cmd : bin };
}

test('claude-cli runner: chat sends the text over stdin, reports activity and blocked writes', async () => {
  const { tmp, bin } = fakeClaude(`#!/usr/bin/env node
let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  const i = process.argv.indexOf('--session-id');
  out({ type: 'system', subtype: 'init', session_id: process.argv[i + 1], model: 'm' });
  out({ type: 'assistant', message: { id: 'a', content: [{ type: 'tool_use', id: 'w1', name: 'Write', input: { file_path: 'x.txt' } }] } });
  out({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'w1', is_error: true, content: "Claude requested permissions to write to x.txt, but you haven't granted it yet." }] } });
  out({ type: 'result', subtype: 'success', result: 'got:' + input, total_cost_usd: 0.1, num_turns: 1, permission_denials: [{ tool_name: 'Write', tool_use_id: 'w1' }] });
});
`);
  const runner = createClaudeCliRunner({ bin, pluginDir: '/p' });
  const seen = [];
  const res = await runner.chat({ agent: AGENT, text: 'hello there', sessionId: null, resume: false, allowEdits: false, workdir: tmp, env: process.env, profileId: 'default', signal: new AbortController().signal, onActivity: (a) => seen.push(a) });
  assert.equal(res.output, 'got:hello there');
  assert.match(res.sessionId, UUID_V4);
  assert.equal(seen[0].init.sessionId, res.sessionId);
  assert.deepEqual(seen.filter((a) => a.kind === 'blocked').map((a) => [a.tool, a.toolUseId]), [['Write', 'w1']]);
});

test('claude-cli runner: chat rejects with the CLI failure', async () => {
  const { tmp, bin } = fakeClaude(`#!/usr/bin/env node
process.stdin.resume();
process.stdin.on('end', () => { process.stderr.write('boom'); process.exit(1); });
`);
  const runner = createClaudeCliRunner({ bin });
  await assert.rejects(runner.chat({ agent: AGENT, text: 'x', sessionId: null, resume: false, allowEdits: false, workdir: tmp, signal: new AbortController().signal }), /boom/);
});
