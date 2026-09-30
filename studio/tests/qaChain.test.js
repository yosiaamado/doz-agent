// QA: migrasi berantai (.local.json plain → app-data → terenkripsi), idempotensi, dan riwayat run format lama.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConfig } from '../server/infra/config.js';
import { emptyRun, reduceRun } from '../web/src/lib/model.js';
import { RunRegistry } from '../server/repositories/runLogRepository.js';

const KEY = 'sk-ant-api03-RAHASIA-CHAIN';
const quiet = { info() {}, warn() {}, error() {} };
const codec = {
  encrypt: (p) => Buffer.from(`enc:${p}`).toString('base64'),
  decrypt(c) { const t = Buffer.from(c, 'base64').toString('utf8'); if (!t.startsWith('enc:')) throw new Error('bad'); return t.slice(4); },
};
function fx() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-qa-')));
  const studio = path.join(root, 'studio');
  fs.mkdirSync(path.join(studio, 'server', 'infra'), { recursive: true });
  fs.mkdirSync(path.join(root, 'work'));
  const mk = (secretCodec) => createConfig({ argv: ['node', 'x'], env: { DOZ_USER_DATA_DIR: path.join(root, 'ud') }, here: path.join(studio, 'server', 'infra'), logger: quiet, secretCodec });
  return { root, studio, ud: path.join(root, 'ud'), mk, cfgRaw: () => fs.readFileSync(path.join(root, 'ud', 'config.json'), 'utf8') };
}

test('rantai: .local.json plain → app-data plain (tanpa codec) → terenkripsi (codec), diulang dua kali, isi lain utuh', () => {
  const f = fx();
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ workdir: path.join(f.root, 'work'), anthropicApiKey: KEY, setup: { done: true } }));
  assert.equal(f.mk(null).savedApiKey(), KEY);
  assert.ok(f.cfgRaw().includes(KEY), 'tanpa codec masih plain (diketahui)');
  for (let i = 0; i < 2; i++) {
    const c = f.mk(codec);
    assert.equal(c.savedApiKey(), KEY, `putaran ${i}`);
    assert.ok(!f.cfgRaw().includes(KEY), `putaran ${i}: plain hilang dari config.json`);
    assert.equal(JSON.parse(f.cfgRaw()).setup.done, true);
  }
});

test('rantai: key plain di .local.json lama tidak tertinggal di disk setelah migrasi terenkripsi', () => {
  const f = fx();
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ anthropicApiKey: KEY }));
  f.mk(codec).savedApiKey();
  const legacy = fs.readFileSync(path.join(f.studio, '.local.json'), 'utf8');
  assert.ok(!legacy.includes(KEY), 'key plain masih ada di studio/.local.json');
});

test('rantai: key terenkripsi lalu dibuka tanpa codec tidak crash dan tidak menghapus ciphertext', () => {
  const f = fx();
  const c = f.mk(codec);
  c.saveApiKey(KEY);
  const plainMode = f.mk(null);
  assert.equal(plainMode.savedApiKey(), null);
  assert.equal(f.mk(codec).savedApiKey(), KEY);
});

// --- riwayat run format lama ---
// Salinan logika logText (shared.jsx tidak bisa diimpor Node karena JSX): msg diterjemahkan, selain itu text apa adanya.
const t = (k) => k;
const logText = (tt, line) => { if (!line.msg) return line.text; const x = tt(line.msg.key, line.msg.params); return x === line.msg.key ? line.text : x; }; // kunci tak dikenal → logText harus jatuh ke text
test('run lama (event tanpa code/params, teks Indonesia) tetap ter-reduce dan log-nya terbaca', () => {
  const legacy = [
    { type: 'run_start', ts: 1, workflow: 'fitur-kecil', input: 'x', run: 'r1' },
    { type: 'node', ts: 2, node: 'a', status: 'running' },
    { type: 'activity', ts: 3, node: 'a', text: 'Membaca berkas', kind: 'tool' },
    { type: 'node', ts: 4, node: 'a', status: 'failed', error: 'Gagal: waktu habis' },
    { type: 'loop', ts: 5, edge: 'a->b', count: 1, max: 2 },
    { type: 'run_end', ts: 6, status: 'failed', error: 'Gagal: waktu habis', cost: 0.1 },
  ];
  let run = emptyRun('r1');
  for (const ev of legacy) run = reduceRun(run, ev);
  assert.equal(run.status, 'failed');
  assert.equal(run.error, 'Gagal: waktu habis');
  const lines = run.log.map((l) => logText(t, l));
  assert.ok(lines.every((x) => typeof x === 'string' && x.length > 0), JSON.stringify(lines));
  assert.ok(lines.includes('Membaca berkas'));
});

test('file .jsonl lama dengan baris rusak dan event tak dikenal: events() tidak melempar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-runs-'));
  fs.writeFileSync(path.join(dir, 'old1.jsonl'), [
    JSON.stringify({ type: 'run_start', ts: 1, workflow: 'w', run: 'old1' }),
    '{bukan json',
    JSON.stringify({ type: 'event_masa_depan', ts: 2, run: 'old1' }),
    JSON.stringify({ type: 'run_end', ts: 3, status: 'done', run: 'old1' }),
  ].join('\n') + '\n');
  const repo = new RunRegistry({ broadcast() {} });
  repo.dir = dir;
  const evs = repo.events('old1');
  assert.equal(evs.length, 3);
  let run = emptyRun('old1');
  for (const ev of evs) run = reduceRun(run, ev);
  assert.equal(run.status, 'done');
  assert.equal(repo.list()[0].workflow, 'w');
});
