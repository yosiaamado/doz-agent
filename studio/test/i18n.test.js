import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import en from '../web/src/i18n/locales/en.json' with { type: 'json' };
import id from '../web/src/i18n/locales/id.json' with { type: 'json' };
import { translate, detectLocale, kebabFromCode, normalizeLocale, LOCALES, DEFAULT_LOCALE } from '../web/src/i18n/index.js';
import { errorMessage } from '../web/src/lib/errorMessage.js';
import { ApiRequestError } from '../web/src/lib/api.js';
import { validate, formatTokens, formatDuration, reduceRun, emptyRun } from '../web/src/lib/model.js';
import { runChecks } from '../scripts/i18n-check.js';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tEn = (k, v) => translate('en', k, v);
const tId = (k, v) => translate('id', k, v);

test('en adalah default dan locale pertama; locale tak dikenal ditolak', () => {
  assert.equal(LOCALES[0], 'en');
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.equal(normalizeLocale('fr'), null);
  assert.equal(normalizeLocale('__proto__'), null);
});

test('deteksi bahasa pertama kali: id-* → id, selain itu en', () => {
  assert.equal(detectLocale('id-ID'), 'id');
  assert.equal(detectLocale('id'), 'id');
  assert.equal(detectLocale('en-US'), 'en');
  assert.equal(detectLocale('fr-FR'), 'en');
  assert.equal(detectLocale(undefined), 'en');
});

test('translate: interpolasi, locale id, fallback ke en, lalu ke kunci itu sendiri', () => {
  assert.equal(tEn('common.save'), 'Save');
  assert.equal(tId('common.save'), 'Simpan');
  assert.equal(tEn('error.workdir-not-found', { path: 'C:\\x' }), 'Folder not found: C:\\x');
  assert.equal(translate('xx', 'common.save'), 'Save');
  assert.equal(tId('no.such.key'), 'no.such.key');
  assert.equal(tEn('error.workdir-not-found'), 'Folder not found: {path}', 'placeholder tanpa nilai dibiarkan');
});

test('errorMessage: kode diterjemahkan dengan params; tanpa kode atau kunci belum ada → err.message', () => {
  const withCode = new ApiRequestError('Folder tidak ada', { code: 'WORKDIR_NOT_FOUND', params: { path: 'E:\\a' } });
  assert.equal(errorMessage(tEn, withCode), 'Folder not found: E:\\a');
  assert.equal(errorMessage(tId, withCode), 'Folder tidak ada: E:\\a');
  assert.equal(errorMessage(tEn, new ApiRequestError('plain message')), 'plain message');
  assert.equal(errorMessage(tEn, new ApiRequestError('raw', { code: 'BRAND_NEW_CODE' })), 'raw');
  assert.equal(kebabFromCode('UPDATE_STALE_MANIFEST'), 'update-stale-manifest');
});

test('ApiRequestError membawa code, params, details', () => {
  const e = new ApiRequestError('x', { details: ['a'], code: 'C', params: { n: 1 } });
  assert.deepEqual([e.code, e.params, e.details], ['C', { n: 1 }, ['a']]);
  const bare = new ApiRequestError('y');
  assert.deepEqual([bare.code, bare.params, bare.details], [null, {}, []]);
});

test('semua kode error wajib dari spec punya terjemahan di en dan id', () => {
  for (const code of ['INTERNAL_ERROR', 'VALIDATION_FAILED', 'NOT_FOUND', 'WORKDIR_NOT_FOUND', 'SOURCE_MISSING', 'REPO_UNAVAILABLE', 'SERVER_UNREACHABLE']) {
    const key = `error.${kebabFromCode(code)}`;
    assert.ok(en[key], `en ${key}`);
    assert.ok(id[key], `id ${key}`);
  }
});

test('formatter dan pesan model mengikuti bahasa aktif, tanpa string Indonesia di en', () => {
  assert.equal(formatTokens(tEn, 1500), '1.5k tokens');
  assert.equal(formatDuration(tEn, 65000), '1m 5s');
  assert.deepEqual(validate({ nodes: [], edges: [] }, []), ['Needs one Start node']);
  const run = reduceRun(emptyRun('r'), { type: 'run_start', workflow: 'wf', ts: 1 });
  assert.equal(run.log[0].text, 'Run started: wf');
  assert.deepEqual(run.log[0].msg, { key: 'logs.event.run-start', params: { workflow: 'wf' } });
  assert.equal(formatDuration(tId, 65000), '1m 5d');
  assert.deepEqual(validate({ nodes: [], edges: [] }, [], tId), ['Butuh satu node Start']);
});

test('i18n:check lolos di repo ini', () => {
  const res = spawnSync(process.execPath, ['scripts/i18n-check.js'], { cwd: STUDIO, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
});

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-i18n-'));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

test('i18n:check gagal: kunci tanpa terjemahan, nilai sama, kunci tak terdefinisi', () => {
  const dir = fixture({ 'A.jsx': "export const A = () => <b>{t('a.one')}{t('a.missing')}</b>;\n" });
  const { errors } = runChecks({ en: { 'a.one': 'One', 'a.two': 'Two' }, id: { 'a.one': 'One' }, srcDir: dir, rootDir: dir });
  const text = errors.join('\n');
  assert.match(text, /kunci belum diterjemahkan: a\.two/);
  assert.match(text, /nilai sama dengan en.*a\.one/);
  assert.match(text, /A\.jsx:1 {2}kunci tidak ada di en\.json: a\.missing/);
});

test('i18n:check gagal: teks hardcoded di JSX, atribut, notify, dan kata Indonesia', () => {
  const dir = fixture({
    'B.jsx': [
      'export const B = () => (',
      '  <div title="Simpan sekarang">',
      '    <span>Hello world</span>',
      '    <button aria-label="Close it" />',
      '  </div>',
      ');',
      "notify('Tersimpan ke file');",
      "const x = { message: 'Are you sure?' };",
      '',
    ].join('\n'),
  });
  const { errors } = runChecks({ en: {}, id: {}, srcDir: dir, rootDir: dir });
  const text = errors.join('\n');
  assert.match(text, /B\.jsx:2 .*atribut/);
  assert.match(text, /B\.jsx:3 .*teks JSX/);
  assert.match(text, /B\.jsx:4 .*atribut/);
  assert.match(text, /B\.jsx:7 /);
  assert.match(text, /B\.jsx:8 .*properti/);
});

test('i18n:check tidak mengeluh untuk kode yang sudah lewat t() dan i18n-ignore', () => {
  const dir = fixture({
    'C.jsx': [
      'export const C = () => (',
      "  <div title={t('c.title')}>",
      "    <span>{t('c.body')}</span>",
      '    {/* i18n-ignore */}',
      '    <b>Doz</b>',
      '  </div>',
      ');',
      '',
    ].join('\n'),
  });
  const { errors } = runChecks({ en: { 'c.title': 'T', 'c.body': 'B' }, id: { 'c.title': 'Ta', 'c.body': 'Bi' }, srcDir: dir, rootDir: dir });
  assert.deepEqual(errors, []);
});
