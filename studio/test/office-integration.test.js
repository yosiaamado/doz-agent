import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../server/app.js';
import { createConfig } from '../server/infra/config.js';
import { createClaudeCliRunner } from '../server/runners/claude-cli.js';
import { emptyActivity, reduceActivity } from '../web/src/lib/activity.js';
import { emptyChats, applyDetail, reduceChat } from '../web/src/hooks/useChats.js';

// Real server + real claude-cli runner + a fake `claude` binary, driven over HTTP and the socket like the UI does.
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-office-')));
const workdir = path.join(tmp, 'proj');
const agentsDir = path.join(tmp, 'agents');
const gate = path.join(tmp, 'release');
// Profile dirs must live inside the real home (createApp reads os.homedir()); removed in after().
const profileDir = path.join(os.homedir(), `.doz-qa-office-${process.pid}`);
fs.mkdirSync(workdir);
fs.mkdirSync(agentsDir);
fs.writeFileSync(path.join(agentsDir, 'technical-lead.md'), '---\nname: technical-lead\ndescription: Leads\ntools: Read, Bash, Task\n---\nLead.\n');

const script = path.join(tmp, 'fake-claude.mjs');
const body = `import fs from 'node:fs';
const args = process.argv.slice(2);
const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', async () => {
  const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  const sid = flag('--session-id') ?? flag('--resume');
  out({ type: 'system', subtype: 'init', model: 'fake', session_id: sid, apiKeySource: 'none', mcp_servers: [], tools: ['Read'] });
  if (input.includes('FAIL')) { process.stderr.write('boom'); process.exit(1); }
  out({ type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'tool_use', id: 't1', name: 'Task', input: { subagent_type: 'qa', description: 'check' } }] } });
  out({ type: 'assistant', parent_tool_use_id: 't1', message: { id: 'm2', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: 'a.js' } }] } });
  out({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } });
  if (input.includes('SLOW')) while (!fs.existsSync(${JSON.stringify(gate)})) await new Promise((r) => setTimeout(r, 20));
  const text = JSON.stringify({ cfg: process.env.CLAUDE_CONFIG_DIR ?? null, resume: flag('--resume') ?? null, sid: flag('--session-id') ?? null });
  out({ type: 'result', subtype: 'success', result: text, total_cost_usd: 0.5, num_turns: 1, session_id: sid, usage: { input_tokens: 2, output_tokens: 2 } });
});
`;
let bin = script;
if (process.platform === 'win32') {
  fs.writeFileSync(script, body);
  bin = path.join(tmp, 'fake-claude.cmd');
  fs.writeFileSync(bin, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
} else {
  fs.writeFileSync(script, `#!${process.execPath}\n${body}`);
  fs.chmodSync(script, 0o755);
}

let server;
let base;
let ws;
const messages = [];

before(async () => {
  const config = createConfig({ argv: ['node', 'x', '--workdir', workdir], env: {}, localFile: path.join(tmp, 'local.json') });
  config.setSources({ agents: [agentsDir] });
  ({ server } = createApp({
    config,
    runners: { 'claude-cli': createClaudeCliRunner({ bin, pluginDir: tmp }), api: {} },
    runnerStatus: () => ({ 'claude-cli': { available: true }, api: { available: false } }),
  }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  ws.on('message', (m) => messages.push(JSON.parse(m)));
  await new Promise((r) => ws.on('open', r));
});

after(() => {
  ws.close();
  server.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
});

const call = async (method, url, payload) => {
  const res = await fetch(`${base}${url}`, { method, headers: payload ? { 'content-type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined });
  return { status: res.status, json: await res.json() };
};
const until = async (cond) => {
  for (let i = 0; i < 500; i += 1) {
    const hit = cond();
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timed out waiting for a socket message');
};
const chatEvents = (id) => messages.filter((m) => m.type === 'chat' && (m.event.chat === id || m.event.chat?.id === id)).map((m) => m.event);
const ended = (id, turn) => () => chatEvents(id).find((e) => e.type === 'chat_turn_end' && e.turn === turn);
const resultOf = (end) => JSON.parse(end.message.text);

let workId;
let chatId;

test('profiles: create, reject bad input with the contract codes, switch broadcasts', async () => {
  const list = await call('GET', '/api/profiles');
  assert.equal(list.json.data.activeProfileId, 'default');
  assert.equal(list.json.data.profiles[0].isDefault, true);

  const made = await call('POST', '/api/profiles', { name: 'Work', configDir: profileDir });
  assert.equal(made.status, 200);
  workId = made.json.data.id;
  assert.match(workId, /^p_[0-9a-f]{8}$/);
  assert.equal(made.json.data.apiKey.state, 'none');

  const dup = await call('POST', '/api/profiles', { name: 'work', configDir: path.join(os.homedir(), '.doz-qa-other') });
  assert.deepEqual([dup.status, dup.json.code, dup.json.params], [400, 'PROFILE_NAME_TAKEN', { name: 'work' }]);
  const out = await call('POST', '/api/profiles', { name: 'X', configDir: path.parse(os.homedir()).root });
  assert.deepEqual([out.status, out.json.code], [400, 'PROFILE_DIR_OUTSIDE_HOME']);
  const blank = await call('POST', '/api/profiles', { name: '  ', configDir: profileDir });
  assert.equal(blank.status, 400);
  assert.equal((await call('POST', '/api/profiles/active', { id: 'p_00000000' })).status, 404);
  assert.equal((await call('PUT', `/api/profiles/${workId}/api-key`, { key: 'short', remember: false })).status, 400);

  const seen = messages.length;
  const sw = await call('POST', '/api/profiles/active', { id: workId });
  assert.deepEqual(sw.json.data, { activeProfileId: workId });
  await until(() => messages.slice(seen).find((m) => m.type === 'profiles' && m.activeProfileId === workId));
});

test('chat: unknown agent 404, empty message 400, bad id 404', async () => {
  const bad = await call('POST', '/api/chats', { agent: 'nobody' });
  assert.deepEqual([bad.status, bad.json.code, bad.json.params], [404, 'CHAT_AGENT_NOT_FOUND', { agent: 'nobody' }]);
  assert.equal((await call('GET', '/api/chats/..%2Fx')).json.code, 'CHAT_NOT_FOUND');
  const made = await call('POST', '/api/chats', { agent: 'technical-lead' });
  assert.equal(made.json.data.profileId, workId);
  chatId = made.json.data.id;
  assert.equal((await call('POST', `/api/chats/${chatId}/messages`, { text: ' \n' })).json.code, 'CHAT_MESSAGE_EMPTY');
  assert.equal((await call('POST', `/api/chats/${chatId}/messages`, {})).status, 400);
  assert.equal((await call('POST', `/api/chats/${chatId}/retry`)).json.code, 'CHAT_NOTHING_TO_RETRY');
});

test('chat turn under the profile env: FE reducers folded over the socket match GET /api/chats/:id', async () => {
  let state = emptyChats();
  const from = messages.length;
  const sent = await call('POST', `/api/chats/${chatId}/messages`, { text: 'hello  world' });
  assert.equal(sent.status, 200);
  assert.equal(sent.json.data.turn, 1);
  const end = await until(ended(chatId, 1));
  assert.equal(end.status, 'done');
  assert.equal(resultOf(end).cfg, profileDir);
  assert.equal(resultOf(end).resume, null);
  assert.ok(resultOf(end).sid);

  for (const m of messages.slice(from)) state = reduceChat(state, m);
  const detail = (await call('GET', `/api/chats/${chatId}`)).json.data;
  const fe = state.chats.find((c) => c.id === chatId);
  assert.equal(fe.status, 'idle');
  assert.equal(fe.title, 'hello world');
  assert.equal(detail.chat.title, 'hello world');
  assert.equal(fe.sessionId, detail.chat.sessionId);
  assert.equal(fe.turns, 1);

  const loaded = applyDetail(state, detail);
  assert.deepEqual(loaded.details[chatId].messages.map((m) => m.role), ['user', 'assistant']);
  const stream = detail.activity.reduce(reduceActivity, emptyActivity());
  assert.equal(stream.init.sessionId, detail.chat.sessionId);
  assert.deepEqual(stream.order, ['t1']);
  assert.equal(stream.subagents.t1.status, 'done');
  assert.equal(stream.subagents.t1.lines[0].text, 'Read: a.js');
  assert.equal(stream.lines.length, 0);

  const second = await call('POST', `/api/chats/${chatId}/messages`, { text: 'again' });
  assert.equal(second.json.data.turn, 2);
  assert.equal(resultOf(await until(ended(chatId, 2))).resume, detail.chat.sessionId);
});

test('switching profiles or sending again while a turn runs is 409; the chat keeps its profile after a switch', async () => {
  await call('POST', `/api/chats/${chatId}/messages`, { text: 'SLOW' });
  const send = await call('POST', `/api/chats/${chatId}/messages`, { text: 'x' });
  assert.deepEqual([send.status, send.json.code], [409, 'CHAT_TURN_ACTIVE']);
  const sw = await call('POST', '/api/profiles/active', { id: 'default' });
  assert.deepEqual([sw.status, sw.json.code], [409, 'PROFILE_SWITCH_BUSY']);
  assert.equal((await call('PUT', `/api/chats/${chatId}`, { allowEdits: true })).json.code, 'CHAT_TURN_ACTIVE');
  assert.equal((await call('DELETE', `/api/chats/${chatId}`)).json.code, 'CHAT_TURN_ACTIVE');
  fs.writeFileSync(gate, '1');
  await until(ended(chatId, 3));
  assert.equal((await call('POST', '/api/profiles/active', { id: 'default' })).status, 200);
  const next = await call('POST', `/api/chats/${chatId}/messages`, { text: 'after switch' });
  assert.equal(resultOf(await until(ended(chatId, next.json.data.turn))).cfg, profileDir);
});

test('CLI failure surfaces as an error message, retry reuses the text with retryOf', async () => {
  const made = (await call('POST', '/api/chats', { agent: 'technical-lead' })).json.data;
  assert.equal(made.profileId, 'default');
  await call('POST', `/api/chats/${made.id}/messages`, { text: 'FAIL please' });
  const end = await until(ended(made.id, 1));
  assert.deepEqual([end.status, end.message.role, end.message.errorCode], ['failed', 'error', 'CHAT_TURN_FAILED']);
  assert.match(end.message.text, /boom|exited with code 1/);

  const retry = await call('POST', `/api/chats/${made.id}/retry`);
  assert.equal(retry.json.data.turn, 2);
  const start = chatEvents(made.id).find((e) => e.type === 'chat_turn_start' && e.turn === 2);
  assert.equal(start.message.retryOf, 1);
  assert.equal(start.message.text, 'FAIL please');
  await until(ended(made.id, 2));

  const del = await call('DELETE', `/api/chats/${made.id}`);
  assert.deepEqual([del.json.data.deleted, del.json.data.transcriptKept], [true, true]);
  assert.ok(chatEvents(made.id).some((e) => e.type === 'chat_deleted'));
});

test('profile delete: active profile is refused; a chat of a deleted profile cannot send', async () => {
  assert.equal((await call('POST', '/api/profiles/active', { id: workId })).status, 200);
  assert.equal((await call('DELETE', `/api/profiles/${workId}`)).json.code, 'PROFILE_ACTIVE');
  await call('POST', '/api/profiles/active', { id: 'default' });
  assert.equal((await call('DELETE', `/api/profiles/${workId}`)).json.data.deleted, true);
  const sent = await call('POST', `/api/chats/${chatId}/messages`, { text: 'hi' });
  assert.deepEqual([sent.status, sent.json.code], [409, 'CHAT_PROFILE_GONE']);
  assert.equal((await call('DELETE', `/api/chats/${chatId}`)).status, 200);
});
