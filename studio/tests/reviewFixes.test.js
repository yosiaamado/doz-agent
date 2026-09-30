// Regressions for the code review findings: CR-1 (secrets in .local.json), CR-2 (resetting node codes), CR-3 (terminal runs),
// CR-4 (git env), CR-5 (hardlinks on the read path), CR-8 (per-endpoint cache), CR-10 (backup layout), English prompts.
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
test('CR-1: after the migration the secret fields are stripped from the legacy .local.json; the rest is intact; the new copy is complete', () => {
  const root = tempDir();
  const studio = path.join(root, 'studio');
  const ud = path.join(root, 'ud');
  fs.mkdirSync(studio);
  fs.writeFileSync(path.join(studio, '.local.json'), JSON.stringify({ workdir: 'W', anthropicApiKey: 'sk-ant-SECRET', anthropicApiKeyEnc: 'CIPHER', setup: { done: true } }));
  assert.deepEqual(migrateLegacyFiles({ studioDir: studio, userDataDir: ud, logger: quiet }), ['config.json']);
  const legacy = fs.readFileSync(path.join(studio, '.local.json'), 'utf8');
  assert.ok(!legacy.includes('SECRET') && !legacy.includes('CIPHER'));
  assert.deepEqual(JSON.parse(legacy), { workdir: 'W', setup: { done: true } });
  assert.equal(JSON.parse(fs.readFileSync(path.join(ud, 'config.json'), 'utf8')).anthropicApiKey, 'sk-ant-SECRET', 'the new copy still carries the key');
  assert.deepEqual(migrateLegacyFiles({ studioDir: studio, userDataDir: ud, logger: quiet }), [], 'idempotent');
});

test('CR-1: scrubSecrets does not throw for a corrupt file or one without secrets, and warns when it fails', () => {
  const dir = tempDir();
  const warnings = [];
  const logger = { warn: (m) => warnings.push(m) };
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{not json');
  assert.equal(scrubSecrets(bad, logger), false);
  assert.equal(warnings.length, 1);
  const clean = path.join(dir, 'clean.json');
  fs.writeFileSync(clean, '{"workdir":"W"}');
  assert.equal(scrubSecrets(clean, logger), false);
  assert.equal(fs.readFileSync(clean, 'utf8'), '{"workdir":"W"}', 'a file without secrets is not rewritten');
});

// ---- CR-2
test('CR-2: re-running a node clears errorCode, errorParams, warningCode, and activityCode (null, not undefined)', async () => {
  const events = [];
  const wf = normalize({ name: 'w', nodes: [{ id: 's', type: 'start' }], edges: [] });
  const run = new WorkflowRun({ id: 't', wf, agents: [], actions: [], input: 'x', workdir: '.', runners: {}, emit: (e) => events.push(e) });
  run.setNode('s', { status: 'failed', error: 'old', errorCode: 'AGENT_NOT_FOUND', errorParams: { agent: 'x' }, warningCode: 'MAX_TURNS_REACHED', activityCode: 'ACTIVITY_WAITING_APPROVAL' });
  await run.execute(wf.nodes[0], new AbortController().signal);
  const running = events.find((e) => e.type === 'node' && e.status === 'running');
  for (const key of ['errorCode', 'errorParams', 'warningCode', 'activityCode']) {
    assert.equal(key in JSON.parse(JSON.stringify(running)), true, `${key} must travel in the JSON event so the UI clears it`);
    assert.equal(running[key], null, key);
  }
});

// ---- CR-3
test('CR-3: hasActive counts a terminal run that is still fresh, and ignores stale or finished ones', () => {
  const now = 10_000_000;
  const runs = new Map([
    ['studio', { status: 'running', run: {}, events: [], started: 0 }],
    ['fresh', { status: 'running', events: [{ ts: now - 60_000 }], started: 0 }],
    ['stale', { status: 'running', events: [{ ts: now - 11 * 60_000 }], started: 0 }],
    ['done', { status: 'done', events: [{ ts: now }], started: 0 }],
  ]);
  const has = (ids) => createRunService({ runLog: { runs: new Map(ids.map((id) => [id, runs.get(id)])) } }).hasActive(now);
  assert.equal(has(['studio']), true);
  assert.equal(has(['fresh']), true, 'a run from /doz-agent:run-workflow blocks updates');
  assert.equal(has(['stale']), false, 'a terminal run that crashed does not block forever');
  assert.equal(has(['done', 'stale']), false);
  assert.equal(has([]), false);
});

// ---- CR-4
test('CR-4: the git snapshot does not carry the studio API key into the user repo hooks', { skip: process.platform === 'win32' && !fs.existsSync('C:\\Program Files\\Git\\bin\\sh.exe') && 'needs sh to run the hook' }, async () => {
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
  if (!fs.existsSync(seen)) return; // an older git without the post-index-change hook: nothing to observe
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

test('CR-5: a hardlink on the read path does not fail the check (it reads as a local edit); writing to it is refused before anything changes', async () => {
  const env = makeEnvironment();
  const outsideDir = tempDir('doz-hl-');
  const outside = path.join(outsideDir, 'victim.md');
  fs.writeFileSync(outside, 'original');
  try {
    fs.linkSync(outside, path.join(env.pluginDir, 'agents', 'a.md'));
  } catch {
    return; // a filesystem without hardlinks
  }
  publish(env, [P('agents/a.md', 'NEW'), P('agents/n.md', 'N')]);
  env.service.setSettings({ endpoint: ENDPOINT() });
  const check = await env.service.check();
  assert.deepEqual(check.localEdits, [{ path: 'plugins/agents/a.md', target: 'plugins' }]);
  const skipped = await env.service.apply({ contentVersion: '1.21.0', overwriteLocalEdits: false });
  assert.deepEqual(skipped.skipped.map((s) => s.path), ['plugins/agents/a.md']);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'original');
  publish(env, [P('agents/a.md', 'NEW2'), P('agents/n2.md', 'N2')], '1.22.0');
  await env.service.check();
  await rejectsWith(env.service.apply({ contentVersion: '1.22.0', overwriteLocalEdits: true }), 'UPDATE_PATH_REJECTED', 422);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'original');
  assert.ok(!env.exists('agents/n2.md'), 'refused at the planning stage, no other file was written');
});

test('CR-8: a check result from an ad-hoc endpoint is not used by apply(); one from the stored endpoint is', async () => {
  const env = makeEnvironment();
  publish(env, [P('agents/a.md', 'A')]);
  const adhoc = await env.service.check({ endpoint: ENDPOINT() });
  assert.equal(adhoc.updateAvailable, true);
  assert.equal(env.service.status().available, null, 'the status does not advertise the ad-hoc result');
  await rejectsWith(env.service.apply({ contentVersion: '1.21.0' }), 'UPDATE_STALE_MANIFEST', 409);
  assert.ok(!env.exists('agents/a.md'));
  env.service.setSettings({ endpoint: ENDPOINT() });
  await env.service.check();
  assert.equal(env.service.status().available.contentVersion, '1.21.0');
  assert.equal((await env.service.apply({ contentVersion: '1.21.0' })).applied, 1);
  // changing the stored endpoint invalidates the earlier check result
  publish(env, [P('agents/a.md', 'A2')], '1.22.0');
  await env.service.check();
  env.service.setSettings({ endpoint: `${srv.base}/other.json` });
  await rejectsWith(env.service.apply({ contentVersion: '1.22.0' }), 'UPDATE_STALE_MANIFEST', 409);
});

test('CR-10: the backup layout mirrors the original structure (backupDir/plugins/agents/..., not plugins/plugins)', async () => {
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
  assert.deepEqual(manifest.files, [{ target: 'plugins', path: 'plugins/agents/a.md' }], 'the backup manifest still uses the manifest paths');
});

// ---- English prompts
test('the agent and judge prompts are in English (headings, feedback, verdict instructions, truncation)', () => {
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
