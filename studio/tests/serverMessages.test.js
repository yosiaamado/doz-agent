// Teks yang dibuat server harus mengirim code + params (UI menerjemahkan) dengan fallback bahasa Inggris, bukan kalimat Indonesia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WorkflowRun } from '../server/domain/engine.js';
import { normalize } from '../server/domain/workflow.js';
import { createConfig } from '../server/infra/config.js';
import { createSetupService } from '../server/services/setupService.js';
import { createFolderService } from '../server/services/folderService.js';
import { startServer } from '../server/app.js';

const INDONESIAN = /\b(tidak|belum|gagal|ditemukan|terpasang|untuk|dengan|sudah|harus|lalu|perintah|persetujuan|menunggu|menilai|dihentikan|ditolak|disetujui|hasil|aktif)\b/i;
const quiet = { info() {}, warn() {}, error() {} };
const tempDir = (name) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), name)));

// Studio tiruan supaya test tidak menyentuh .local.json asli; DOZ_RESOURCES_DIR = mode packaged (repoRoot null).
function packagedConfig(tmp, extraEnv = {}) {
  const here = path.join(tmp, 'studio', 'server', 'infra');
  fs.mkdirSync(here, { recursive: true });
  fs.mkdirSync(path.join(tmp, 'plugins', 'agents'), { recursive: true });
  const env = { DOZ_USER_DATA_DIR: path.join(tmp, 'ud'), DOZ_PLUGIN_DIR: path.join(tmp, 'plugins'), DOZ_RESOURCES_DIR: path.join(tmp, 'res'), ...extraEnv };
  return createConfig({ argv: ['node', 'x', '--workdir', tmp], env, here, logger: quiet });
}

const fakeApiRunner = { testApiConnection: async () => ({ model: 'm', reply: 'ok', ms: 1 }), resetClient() {} };

test('/api/setup: setiap item membawa teks Inggris; item yang kita tulis punya code, repo memakai target', async () => {
  const tmp = tempDir('doz-msg-');
  const config = packagedConfig(tmp);
  const setup = createSetupService({ config, apiRunner: fakeApiRunner, claudeRunner: {} });
  const res = await setup.check();
  for (const key of ['node', 'claude', 'claudeAuth', 'plugin', 'apiKey', 'git', 'repo', 'project']) {
    const item = res[key];
    for (const field of ['detail', 'fix']) assert.doesNotMatch(item[field] ?? '', INDONESIAN, `${key}.${field}: ${item[field]}`);
    if (item.fix && /Install|install/.test(item.fix)) assert.ok(item.fixCode, `${key} butuh fixCode`);
  }
  assert.equal(res.repo.code, 'REPO_SKIPPED');
  assert.equal(res.repo.skipped, true);
  assert.equal(res.project.code, 'REPO_NOT_GIT');
  assert.deepEqual(res.project.params, { target: 'workdir' });
  assert.ok(['API_KEY_SET', 'API_KEY_MISSING_OPTIONAL'].includes(res.apiKey.code));
  assert.doesNotMatch(res.project.detail, INDONESIAN);
});

test('setup.test: hasil sukses dan error membawa code + params', async () => {
  const tmp = tempDir('doz-msg-');
  const config = packagedConfig(tmp);
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  try {
    const setup = createSetupService({ config, apiRunner: fakeApiRunner, claudeRunner: { judge: async () => ({ output: 'ok', cost: 0 }) } });
    const api = await setup.test('api');
    assert.deepEqual([api.code, api.params.model, api.params.ms], ['TEST_API_OK', 'm', 1]);
    const cli = await setup.test('claude-cli');
    assert.equal(cli.code, 'TEST_CLI_OK');
    delete process.env.ANTHROPIC_API_KEY;
    await assert.rejects(setup.test('api'), (e) => e.code === 'API_KEY_REQUIRED');
    await assert.rejects(setup.test('lain'), (e) => e.code === 'SETUP_TEST_UNKNOWN' && e.params.name === 'lain');
    await assert.rejects(setup.test('github', 'repo'), (e) => e.code === 'REPO_UNAVAILABLE');
  } finally {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
});

test('shortcut folder: id stabil + label Inggris; shortcut repo hanya kalau ada repo induk', () => {
  const tmp = tempDir('doz-msg-');
  const packaged = createFolderService(packagedConfig(tmp)).list(tmp).roots;
  assert.deepEqual(packaged.slice(0, 2).map((r) => r.id), ['home', 'workdir']);
  assert.ok(!packaged.some((r) => r.id === 'repo'));
  for (const r of packaged) assert.doesNotMatch(r.label, INDONESIAN);
  const withRepo = createFolderService({ getWorkdir: () => tmp, repoRoot: tmp }).list(tmp).roots;
  assert.ok(withRepo.some((r) => r.id === 'repo' && r.label === 'doz-agent repo'));
  assert.ok(withRepo.every((r) => r.id));
});

test('chip runner: detail Inggris + code stabil', async () => {
  const tmp = tempDir('doz-msg-');
  const previous = process.env.ANTHROPIC_API_KEY;
  const started = await startServer({ config: packagedConfig(tmp), port: 0, runners: { 'claude-cli': {}, api: {} } });
  try {
    const statusOf = async () => (await (await fetch(`${started.url}/api/status`)).json()).data.runners;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const withKey = await statusOf();
    assert.equal(withKey.api.code, 'API_KEY_PRESENT');
    delete process.env.ANTHROPIC_API_KEY;
    const withoutKey = await statusOf();
    assert.equal(withoutKey.api.code, 'API_KEY_NOT_SET');
    for (const runner of Object.values(withoutKey)) {
      assert.doesNotMatch(runner.detail, INDONESIAN);
      if (!runner.available) assert.ok(runner.code, 'runner tidak tersedia harus punya code');
    }
  } finally {
    await new Promise((r) => started.server.close(r));
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  }
});

const AGENTS = [{ name: 'dev', description: 'd', tools: ['Read'], model: 'sonnet', prompt: 'p' }];

async function runWorkflow(wf, { runner, onEvent, budget } = {}) {
  const events = [];
  const fake = runner ?? { run: async () => ({ output: 'ok', cost: 0.1 }), judge: async () => ({ output: 'VERDICT: PASS', cost: 0 }) };
  const r = new WorkflowRun({
    id: 't', wf: normalize({ ...wf, ...(budget ? { budget_usd: budget } : {}) }), agents: AGENTS, actions: [], input: 'x', workdir: '.',
    runners: { 'claude-cli': fake, api: fake },
    emit: (e) => { events.push(e); onEvent?.(e, r); },
  });
  const status = await r.start();
  return { status, r, events };
}

const edge = (from, to, extra = {}) => ({ from, to, ...extra });

test('engine: agent tidak ada → errorCode di node dan NODE_FAILED di run_end, tanpa teks Indonesia', async () => {
  const { status, r, events } = await runWorkflow({ name: 'w', nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'agent', agent: 'nope' }], edges: [edge('s', 'a')] });
  assert.equal(status, 'failed');
  assert.equal(r.state.a.errorCode, 'AGENT_NOT_FOUND');
  assert.deepEqual(r.state.a.errorParams, { agent: 'nope' });
  const end = events.find((e) => e.type === 'run_end');
  assert.equal(end.errorCode, 'NODE_FAILED');
  assert.equal(end.errorParams.node, 'a');
  assert.doesNotMatch(end.error, INDONESIAN);
});

test('engine: budget terlampaui → BUDGET_EXCEEDED dengan params angka', async () => {
  const { r } = await runWorkflow({ name: 'w', nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'agent', agent: 'dev' }], edges: [edge('s', 'a')] }, { budget: 0.05 });
  assert.equal(r.errorCode, 'BUDGET_EXCEEDED');
  assert.deepEqual(r.errorParams, { budget: 0.05, cost: 0.1 });
});

test('engine: approval → activityCode saat menunggu, dibersihkan setelahnya; approve node lain → NODE_NOT_WAITING', async () => {
  const wf = { name: 'w', nodes: [{ id: 's', type: 'start' }, { id: 'ok', type: 'approval' }, { id: 'end', type: 'output' }], edges: [edge('s', 'ok'), edge('ok', 'end', { when: true })] };
  const { events, r } = await runWorkflow(wf, { onEvent: (e, run) => { if (e.type === 'node' && e.status === 'waiting') setTimeout(() => run.approve(e.node, true)); } });
  const waiting = events.find((e) => e.type === 'node' && e.status === 'waiting');
  assert.equal(waiting.activityCode, 'ACTIVITY_WAITING_APPROVAL');
  assert.equal(waiting.activity, 'Waiting for approval');
  const cleared = events.filter((e) => e.type === 'node' && e.node === 'ok' && 'activity' in e && e.activity === null);
  assert.ok(cleared.length && cleared.every((e) => e.activityCode === null));
  assert.match(r.state.ok.output, /^Approved/);
  assert.throws(() => r.approve('ok', true), (e) => e.code === 'NODE_NOT_WAITING' && e.params.node === 'ok');
});

test('engine: retry dan judging mengirim activity dengan code + params', async () => {
  let calls = 0;
  const runner = { run: async () => { calls += 1; if (calls === 1) throw new Error('boom'); return { output: 'ok', cost: 0 }; }, judge: async () => ({ output: 'VERDICT: PASS', cost: 0 }) };
  const wf = { name: 'w', nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'agent', agent: 'dev', retry: 1 }, { id: 'c', type: 'condition', check: 'is it fine?', mode: 'llm' }, { id: 'e', type: 'output' }], edges: [edge('s', 'a'), edge('a', 'c'), edge('c', 'e', { when: true })] };
  const { events } = await runWorkflow(wf, { runner });
  const retry = events.find((e) => e.kind === 'retry');
  assert.deepEqual([retry.code, retry.params], ['ACTIVITY_RETRY', { reason: 'boom' }]);
  const judging = events.find((e) => e.code === 'ACTIVITY_JUDGING');
  assert.deepEqual(judging.params, { check: 'is it fine?' });
  for (const e of events.filter((ev) => ev.type === 'activity')) assert.doesNotMatch(e.text, INDONESIAN);
});

// Pesan log dibaca saat pembeli melapor masalah: harus Inggris (sapuan atas semua sumber server).
test('pesan logger dan banner di server/** tidak berbahasa Indonesia', () => {
  const words = /\b(tidak|gagal|belum|dari|untuk|dengan|sudah|jalan|terpakai|disalin|dipindahkan|bisa|dimatikan|dibersihkan|rahasia|tersimpan)\b/i;
  const offenders = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!ent.name.endsWith('.js')) continue;
      const source = fs.readFileSync(full, 'utf8');
      for (const m of source.matchAll(/logger\??\.(?:warn|info|error|debug)\(\s*(['`])([^'`]*)\1/g)) if (words.test(m[2])) offenders.push(`${path.relative(process.cwd(), full)}: ${m[2]}`);
      for (const m of source.matchAll(/logger\.banner\(\[([\s\S]*?)\]\)/g)) if (words.test(m[1].replace(/\/\/.*$/gm, ''))) offenders.push(`${path.relative(process.cwd(), full)}: banner`);
    }
  };
  walk(path.resolve('server'));
  assert.deepEqual(offenders, []);
});
