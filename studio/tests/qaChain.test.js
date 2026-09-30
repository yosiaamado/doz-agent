// QA: the migration chain (.local.json plain → app-data → encrypted), idempotency, and run history in the legacy format.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createConfig } from '../server/infra/config.js';
import { emptyRun, reduceRun } from '../web/src/lib/model.js';
import { RunRegistry } from '../server/repositories/runLogRepository.js';

const KEY = 'sk-ant-api03-SECRET-CHAIN';
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

test('chain: .local.json plain → app-data plain (no codec) → encrypted (codec), repeated twice, the rest of the contents intact', () => {
  const f = fx();
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ workdir: path.join(f.root, 'work'), anthropicApiKey: KEY, setup: { done: true } }));
  assert.equal(f.mk(null).savedApiKey(), KEY);
  assert.ok(f.cfgRaw().includes(KEY), 'without a codec it is still plain (a known limitation)');
  for (let i = 0; i < 2; i++) {
    const c = f.mk(codec);
    assert.equal(c.savedApiKey(), KEY, `round ${i}`);
    assert.ok(!f.cfgRaw().includes(KEY), `round ${i}: the plain text is gone from config.json`);
    assert.equal(JSON.parse(f.cfgRaw()).setup.done, true);
  }
});

test('chain: a plain key in the legacy .local.json is not left on disk after the encrypted migration', () => {
  const f = fx();
  fs.writeFileSync(path.join(f.studio, '.local.json'), JSON.stringify({ anthropicApiKey: KEY }));
  f.mk(codec).savedApiKey();
  const legacy = fs.readFileSync(path.join(f.studio, '.local.json'), 'utf8');
  assert.ok(!legacy.includes(KEY), 'the plain key is still in studio/.local.json');
});

test('chain: an encrypted key opened without a codec does not crash and does not delete the ciphertext', () => {
  const f = fx();
  const c = f.mk(codec);
  c.saveApiKey(KEY);
  const plainMode = f.mk(null);
  assert.equal(plainMode.savedApiKey(), null);
  assert.equal(f.mk(codec).savedApiKey(), KEY);
});

// --- run history in the legacy format ---
// A copy of the logText logic (shared.jsx cannot be imported by Node because of the JSX): msg is translated, everything else is text as-is.
const t = (k) => k;
const logText = (tt, line) => { if (!line.msg) return line.text; const x = tt(line.msg.key, line.msg.params); return x === line.msg.key ? line.text : x; }; // an unknown key → logText must fall back to text
test('a legacy run (events without code/params, Indonesian text) still reduces and its log stays readable', () => {
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

test('a legacy .jsonl file with a corrupt line and an unknown event: events() does not throw', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-runs-'));
  fs.writeFileSync(path.join(dir, 'old1.jsonl'), [
    JSON.stringify({ type: 'run_start', ts: 1, workflow: 'w', run: 'old1' }),
    '{not json',
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
