// Regresi temuan code review: CR-1 (rahasia di .local.json), CR-2 (reset kode node), CR-3 (run terminal),
// CR-4 (env git), CR-5 (hardlink di jalur baca), CR-8 (cache per endpoint), CR-10 (layout backup), prompt berbahasa Inggris.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { migrateLegacyFiles, scrubSecrets } from '../server/infra/configStore.js';
import { WorkflowRun } from '../server/domain/engine.js';
import { normalize } from '../server/domain/workflow.js';
import { buildNodePrompt, buildJudgePrompt, truncate, VERDICT_INSTRUCTION } from '../server/domain/prompt.js';
import { createRunService } from '../server/services/runService.js';
import { snapshot } from '../server/infra/gitdiff.js';
import { setInjectedApiKey } from '../server/lib/secretEnv.js';
import { buildManifest, makeEnvironment, startPayloadServer, rejectsWith } from './updateFixture.js';

const quiet = { info() {}, warn() {}, error() {} };
const tempDir = (name = 'doz-cr-') => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), name)));
const INDONESIAN = /\b(catatan|permintaan|hasil langkah|tugasmu|umpan balik|penilai|pertanyaan|kolom|dipotong)\b/i;

let srv;
before(async () => { srv = await startPayloadServer(); });
after(() => srv.close());

// ---- CR-1
test('CR-1: setelah migrasi, field rahasia dibuang dari .local.json lama; isi lain utuh; salinan baru lengkap', () => {
  const root = tempDir();
  const studio = path.join(root, 'studio');
  const ud = path.join(root, 'ud');
  fs.mkdirSync(studio);
  fs.writeFileSync(path.join(studio, '.local.json'), JSON.stringify({ workdir: 'W', anthropicApiKey: 'sk-ant-RAHASIA', anthropicApiKeyEnc: 'CIPHER', setup: { done: true } }));
  assert.deepEqual(migrateLegacyFiles({ studioDir: studio, userDataDir: ud, logger: quiet }), ['config.json']);
  const legacy = fs.readFileSync(path.join(studio, '.local.json'), 'utf8');
  assert.ok(!legacy.includes('RAHASIA') && !legacy.includes('CIPHER'));
  assert.deepEqual(JSON.parse(legacy), { workdir: 'W', setup: { done: true } });
  assert.equal(JSON.parse(fs.readFileSync(path.join(ud, 'config.json'), 'utf8')).anthropicApiKey, 'sk-ant-RAHASIA', 'salinan baru tetap membawa key');
  assert.deepEqual(migrateLegacyFiles({ studioDir: studio, userDataDir: ud, logger: quiet }), [], 'idempoten');
});

test('CR-1: scrubSecrets tidak melempar untuk file rusak atau tanpa rahasia, dan memperingatkan kalau gagal', () => {
  const dir = tempDir();
  const warnings = [];
  const logger = { warn: (m) => warnings.push(m) };
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{bukan json');
  assert.equal(scrubSecrets(bad, logger), false);
  assert.equal(warnings.length, 1);
  const clean = path.join(dir, 'clean.json');
  fs.writeFileSync(clean, '{"workdir":"W"}');
  assert.equal(scrubSecrets(clean, logger), false);
  assert.equal(fs.readFileSync(clean, 'utf8'), '{"workdir":"W"}', 'file tanpa rahasia tidak ditulis ulang');
});

// ---- CR-2
test('CR-2: menjalankan ulang node membersihkan errorCode, errorParams, warningCode, dan activityCode (null, bukan undefined)', async () => {
  const events = [];
  const wf = normalize({ name: 'w', nodes: [{ id: 's', type: 'start' }], edges: [] });
  const run = new WorkflowRun({ id: 't', wf, agents: [], actions: [], input: 'x', workdir: '.', runners: {}, emit: (e) => events.push(e) });
  run.setNode('s', { status: 'failed', error: 'lama', errorCode: 'AGENT_NOT_FOUND', errorParams: { agent: 'x' }, warningCode: 'MAX_TURNS_REACHED', activityCode: 'ACTIVITY_WAITING_APPROVAL' });
  await run.execute(wf.nodes[0], new AbortController().signal);
  const running = events.find((e) => e.type === 'node' && e.status === 'running');
  for (const key of ['errorCode', 'errorParams', 'warningCode', 'activityCode']) {
    assert.equal(key in JSON.parse(JSON.stringify(running)), true, `${key} harus ikut di JSON event supaya UI menghapusnya`);
    assert.equal(running[key], null, key);
  }
});

// ---- CR-3
test('CR-3: hasActive menghitung run terminal yang masih segar, mengabaikan yang basi atau sudah selesai', () => {
  const now = 10_000_000;
  const runs = new Map([
    ['studio', { status: 'running', run: {}, events: [], started: 0 }],
    ['fresh', { status: 'running', events: [{ ts: now - 60_000 }], started: 0 }],
    ['stale', { status: 'running', events: [{ ts: now - 11 * 60_000 }], started: 0 }],
    ['done', { status: 'done', events: [{ ts: now }], started: 0 }],
  ]);
  const has = (ids) => createRunService({ runLog: { runs: new Map(ids.map((id) => [id, runs.get(id)])) } }).hasActive(now);
  assert.equal(has(['studio']), true);
  assert.equal(has(['fresh']), true, 'run dari /doz-agent:run-workflow memblokir update');
  assert.equal(has(['stale']), false, 'run terminal yang crash tidak memblokir selamanya');
  assert.equal(has(['done', 'stale']), false);
  assert.equal(has([]), false);
});

// ---- CR-4
test('CR-4: snapshot git tidak membawa API key studio ke hook repo user', { skip: process.platform === 'win32' && !fs.existsSync('C:\\Program Files\\Git\\bin\\sh.exe') && 'butuh sh untuk menjalankan hook' }, async () => {
  const dir = tempDir();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=a', '-c', 'user.email=a@b', 'commit', '--allow-empty', '-qm', 'x'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'f.txt'), 'x');
  const seen = path.join(dir, 'seen.txt');
  const out = seen.split(path.sep).join('/');
  fs.writeFileSync(path.join(dir, '.git', 'hooks', 'post-index-change'), `#!/bin/sh\necho "KEY=$ANTHROPIC_API_KEY" >> "${out}"\n`, { mode: 0o755 });
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-SECRET';
  setInjectedApiKey('sk-ant-SECRET');
  try {
    await snapshot(dir);
  } finally {
    setInjectedApiKey(null);
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
  if (!fs.existsSync(seen)) return; // git versi lama tanpa hook post-index-change: tidak ada yang bisa diamati
  const text = fs.readFileSync(seen, 'utf8');
  assert.match(text, /KEY=/);
  assert.doesNotMatch(text, /SECRET/);
});

// ---- CR-5, CR-8, CR-10
const P = (rel, content) => ({ path: `plugins/${rel}`, target: 'plugins', content });
const ENDPOINT = () => `${srv.base}/doz-update.json`;
function publish(env, files, version = '1.21.0') {
  srv.publish({ manifest: buildManifest({ version, base: srv.base, files }), files, privateKey: env.privateKey });
}

test('CR-5: hardlink di jalur baca tidak menggagalkan check (dibaca sebagai edit lokal); menulisnya ditolak sebelum ada yang berubah', async () => {
  const env = makeEnvironment();
  const outsideDir = tempDir('doz-hl-');
  const outside = path.join(outsideDir, 'victim.md');
  fs.writeFileSync(outside, 'asli');
  try {
    fs.linkSync(outside, path.join(env.pluginDir, 'agents', 'a.md'));
  } catch {
    return; // filesystem tanpa hardlink
  }
  publish(env, [P('agents/a.md', 'BARU'), P('agents/n.md', 'N')]);
  env.service.setSettings({ endpoint: ENDPOINT() });
  const check = await env.service.check();
  assert.deepEqual(check.localEdits, [{ path: 'plugins/agents/a.md', target: 'plugins' }]);
  const skipped = await env.service.apply({ contentVersion: '1.21.0', overwriteLocalEdits: false });
  assert.deepEqual(skipped.skipped.map((s) => s.path), ['plugins/agents/a.md']);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'asli');
  publish(env, [P('agents/a.md', 'BARU2'), P('agents/n2.md', 'N2')], '1.22.0');
  await env.service.check();
  await rejectsWith(env.service.apply({ contentVersion: '1.22.0', overwriteLocalEdits: true }), 'UPDATE_PATH_REJECTED', 422);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'asli');
  assert.ok(!env.exists('agents/n2.md'), 'ditolak di tahap rencana, tidak ada file lain ditulis');
});

test('CR-8: hasil cek dari endpoint ad-hoc tidak dipakai apply(); hasil dari endpoint tersimpan dipakai', async () => {
  const env = makeEnvironment();
  publish(env, [P('agents/a.md', 'A')]);
  const adhoc = await env.service.check({ endpoint: ENDPOINT() });
  assert.equal(adhoc.updateAvailable, true);
  assert.equal(env.service.status().available, null, 'status tidak mengiklankan hasil ad-hoc');
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
  assert.ok(!env.exists('agents/a.md'));
  env.service.setSettings({ endpoint: ENDPOINT() });
  await env.service.check();
  assert.equal(env.service.status().available.contentVersion, '1.21.0');
  assert.equal((await env.service.apply({ contentVersion: '1.21.0' })).applied, 1);
  // mengganti endpoint tersimpan membatalkan hasil cek sebelumnya
  publish(env, [P('agents/a.md', 'A2')], '1.22.0');
  await env.service.check();
  env.service.setSettings({ endpoint: `${srv.base}/lain.json` });
  await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_STALE_MANIFEST', 409);
});

test('CR-10: layout backup mencerminkan struktur asli (backupDir/plugins/agents/..., bukan plugins/plugins)', async () => {
  const env = makeEnvironment();
  publish(env, [P('agents/a.md', 'A1')]);
  env.service.setSettings({ endpoint: ENDPOINT() });
  await env.service.check();
  await env.service.apply({ contentVersion: '1.21.0' });
  publish(env, [P('agents/a.md', 'A2')], '1.22.0');
  await env.service.check();
  const res = await env.service.apply({ contentVersion: '1.22.0' });
  assert.equal(fs.readFileSync(path.join(res.backupDir, 'plugins', 'agents', 'a.md'), 'utf8'), 'A1');
  assert.ok(!fs.existsSync(path.join(res.backupDir, 'plugins', 'plugins')));
  const manifest = JSON.parse(fs.readFileSync(path.join(res.backupDir, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.files, [{ target: 'plugins', path: 'plugins/agents/a.md' }], 'manifest backup tetap memakai path manifest');
});

// ---- prompt berbahasa Inggris
test('prompt untuk agent dan penilai berbahasa Inggris (heading, umpan balik, instruksi verdict, pemotongan)', () => {
  const prompt = buildNodePrompt({
    wf: { name: 'w', description: 'd', notes: 'n' },
    node: { id: 'a', instructions: '' },
    settings: { max_output_chars: 10 },
    input: '',
    upstream: [{ node: { id: 'p', label: 'Prev' }, output: 'x'.repeat(50) }],
    infos: ['info'],
    feedback: { attempt: 2, from: 'QA', output: 'bug' },
  });
  for (const heading of ['## Workflow notes', '## Request', '(empty)', '## Additional context', '## Results of previous steps', '## Feedback (attempt 2)', '## Your task in this step', 'characters truncated']) {
    assert.ok(prompt.includes(heading), heading);
  }
  const all = [prompt, buildJudgePrompt({ question: 'q', subject: 's' }), VERDICT_INSTRUCTION, truncate('x'.repeat(40), 10)].join('\n');
  assert.doesNotMatch(all, INDONESIAN);
  assert.match(VERDICT_INSTRUCTION, /VERDICT: PASS/);
});
