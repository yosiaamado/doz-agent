import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { createApp } from '../server/app.js';
import { createConfig } from '../server/infra/config.js';
import { Router } from '../server/http/router.js';
import { docxToText } from '../server/services/attachmentService.js';
import { summarizeRows } from '../server/services/usageService.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-api-'));
const workdir = path.join(tmp, 'proj');
fs.mkdirSync(workdir);
fs.mkdirSync(path.join(tmp, 'agents'));

const fakeRunner = {
  describe: () => 'fake',
  run: async ({ prompt }) => ({ output: `echo: ${prompt.includes('Attached documents') ? 'with documents' : 'without documents'}\nVERDICT: PASS`, cost: 0.01 }),
  judge: async () => ({ output: 'VERDICT: PASS' }),
};

let server;
let base;

before(async () => {
  const config = createConfig({ argv: ['node', 'x', '--workdir', workdir], env: {}, localFile: path.join(tmp, 'local.json') });
  config.setSources({ agents: ['plugins/agents', path.join(tmp, 'agents')] });
  ({ server } = createApp({
    config,
    runners: { 'claude-cli': fakeRunner, api: fakeRunner },
    runnerStatus: () => ({ 'claude-cli': { available: true }, api: { available: false } }),
  }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const call = async (method, url, body) => {
  const res = await fetch(`${base}${url}`, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json() };
};

test('the API responses use the { success, data } shape', async () => {
  const { status, json } = await call('GET', '/api/status');
  assert.equal(status, 200);
  assert.equal(json.success, true);
  assert.equal(json.data.workdir, workdir);
  assert.match(json.data.appVersion, /^\d+\.\d+\.\d+/);
  assert.match(json.data.contentVersion, /^\d+\.\d+\.\d+/);
});

test('input validation: a malformed body → 400 with details', async () => {
  const { status, json } = await call('POST', '/api/runs/x/approve', { node: 'a' });
  assert.equal(status, 400);
  assert.equal(json.success, false);
  assert.ok(json.details.some((d) => d.includes('approved')));
});

test('a missing endpoint → 404, a foreign host → 403', async () => {
  assert.equal((await call('GET', '/api/does-not-exist')).status, 404);
  const res = await fetch(`${base}/api/status`, { headers: { origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('creating and editing an agent in a source folder', async () => {
  const dir = path.join(tmp, 'agents');
  const created = await call('POST', '/api/library/agents', { name: 'writer', dir, meta: { description: 'Writes', tools: 'Read' }, body: 'You are a writer.' });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  const updated = await call('PUT', '/api/library/agents/writer', { meta: { model: 'haiku' } });
  assert.match(updated.json.data.text, /model: haiku/);
  assert.match(updated.json.data.text, /description: Writes/);
  const outside = await call('POST', '/api/library/agents', { name: 'x', dir: '/etc' });
  assert.equal(outside.status, 400);
});

test('a run with document attachments through to completion', async () => {
  const doc = await call('POST', '/api/attachments', { name: 'spec.md', contentBase64: Buffer.from('# Spec\nfeature X').toString('base64') });
  assert.equal(doc.json.data.kind, 'text');
  const workflow = {
    name: 'trial', nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'agent', agent: 'writer' }],
    edges: [{ from: 's', to: 'a' }],
  };
  const started = await call('POST', '/api/runs', { workflow, input: 'get to work', attachments: [doc.json.data.id] });
  assert.equal(started.status, 200, JSON.stringify(started.json));
  let events = [];
  for (let i = 0; i < 50 && !events.some((e) => e.type === 'run_end'); i++) {
    await new Promise((r) => setTimeout(r, 20));
    events = (await call('GET', `/api/runs/${started.json.data.id}`)).json.data.events;
  }
  const end = events.find((e) => e.type === 'run_end');
  assert.equal(end.status, 'done');
  assert.match(events.find((e) => e.node === 'a' && e.status === 'done').output, /with documents/);
});

test('the folder browser returns the subfolders and the roots', async () => {
  fs.mkdirSync(path.join(workdir, 'src'), { recursive: true });
  const { json } = await call('GET', `/api/folders?path=${encodeURIComponent(workdir)}`);
  assert.deepEqual(json.data.folders.map((f) => f.name), ['src']);
  assert.equal(json.data.display, '{workdir}');
  assert.ok(json.data.roots.length >= 3);
});

test('the router matches path parameters', () => {
  const r = new Router().get('/api/x/:kind/:name', () => 'ok');
  assert.deepEqual(r.resolve('GET', '/api/x/agents/qa%20tester').params, { kind: 'agents', name: 'qa tester' });
  assert.throws(() => r.resolve('POST', '/api/x/a/b'), /No endpoint/);
});

test('docx is converted to text', () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>Hello &amp; world</w:t></w:r></w:p><w:p><w:r><w:t>Line 2</w:t></w:r></w:p></w:body></w:document>';
  const buffer = Buffer.from(zipSync({ 'word/document.xml': strToU8(xml) }));
  assert.equal(docxToText(buffer), 'Hello & world\nLine 2');
});

test('the token summary per 5-hour and 7-day window', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  const rows = [
    { ts: now - 3_600_000, model: 'opus', tokens: 100 },
    { ts: now - 10 * 3_600_000, model: 'haiku', tokens: 50 },
  ];
  const s = summarizeRows(rows, now);
  assert.equal(s.five_hour.tokens, 100);
  assert.equal(s.seven_day.tokens, 150);
  assert.deepEqual(s.seven_day.byModel, { opus: 100, haiku: 50 });
});
