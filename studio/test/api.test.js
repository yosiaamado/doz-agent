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
  run: async ({ prompt }) => ({ output: `echo: ${prompt.includes('Dokumen terlampir') ? 'dengan dokumen' : 'tanpa dokumen'}\nVERDICT: PASS`, cost: 0.01 }),
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

test('respons API memakai format { success, data }', async () => {
  const { status, json } = await call('GET', '/api/status');
  assert.equal(status, 200);
  assert.equal(json.success, true);
  assert.equal(json.data.workdir, workdir);
});

test('validasi input: body salah → 400 dengan detail', async () => {
  const { status, json } = await call('POST', '/api/runs/x/approve', { node: 'a' });
  assert.equal(status, 400);
  assert.equal(json.success, false);
  assert.ok(json.details.some((d) => d.includes('approved')));
});

test('endpoint tidak ada → 404, host asing → 403', async () => {
  assert.equal((await call('GET', '/api/tidak-ada')).status, 404);
  const res = await fetch(`${base}/api/status`, { headers: { origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('buat dan edit agent di folder sumber', async () => {
  const dir = path.join(tmp, 'agents');
  const created = await call('POST', '/api/library/agents', { name: 'penulis', dir, meta: { description: 'Menulis', tools: 'Read' }, body: 'Kamu penulis.' });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  const updated = await call('PUT', '/api/library/agents/penulis', { meta: { model: 'haiku' } });
  assert.match(updated.json.data.text, /model: haiku/);
  assert.match(updated.json.data.text, /description: Menulis/);
  const outside = await call('POST', '/api/library/agents', { name: 'x', dir: '/etc' });
  assert.equal(outside.status, 400);
});

test('run dengan lampiran dokumen sampai selesai', async () => {
  const doc = await call('POST', '/api/attachments', { name: 'spec.md', contentBase64: Buffer.from('# Spec\nfitur X').toString('base64') });
  assert.equal(doc.json.data.kind, 'text');
  const workflow = {
    name: 'uji', nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'agent', agent: 'penulis' }],
    edges: [{ from: 's', to: 'a' }],
  };
  const started = await call('POST', '/api/runs', { workflow, input: 'kerjakan', attachments: [doc.json.data.id] });
  assert.equal(started.status, 200, JSON.stringify(started.json));
  let events = [];
  for (let i = 0; i < 50 && !events.some((e) => e.type === 'run_end'); i++) {
    await new Promise((r) => setTimeout(r, 20));
    events = (await call('GET', `/api/runs/${started.json.data.id}`)).json.data.events;
  }
  const end = events.find((e) => e.type === 'run_end');
  assert.equal(end.status, 'done');
  assert.match(events.find((e) => e.node === 'a' && e.status === 'done').output, /dengan dokumen/);
});

test('penjelajah folder mengembalikan subfolder dan root', async () => {
  fs.mkdirSync(path.join(workdir, 'src'), { recursive: true });
  const { json } = await call('GET', `/api/folders?path=${encodeURIComponent(workdir)}`);
  assert.deepEqual(json.data.folders.map((f) => f.name), ['src']);
  assert.equal(json.data.display, '{workdir}');
  assert.ok(json.data.roots.length >= 3);
});

test('router mencocokkan parameter path', () => {
  const r = new Router().get('/api/x/:kind/:name', () => 'ok');
  assert.deepEqual(r.resolve('GET', '/api/x/agents/qa%20tester').params, { kind: 'agents', name: 'qa tester' });
  assert.throws(() => r.resolve('POST', '/api/x/a/b'), /tidak ada endpoint/);
});

test('docx diubah jadi teks', () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>Halo &amp; dunia</w:t></w:r></w:p><w:p><w:r><w:t>Baris 2</w:t></w:r></w:p></w:body></w:document>';
  const buffer = Buffer.from(zipSync({ 'word/document.xml': strToU8(xml) }));
  assert.equal(docxToText(buffer), 'Halo & dunia\nBaris 2');
});

test('ringkasan token per jendela 5 jam dan 7 hari', () => {
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
