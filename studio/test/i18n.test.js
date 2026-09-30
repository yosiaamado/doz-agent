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

test('en is the default and the first locale; an unknown locale is rejected', () => {
  assert.equal(LOCALES[0], 'en');
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.equal(normalizeLocale('fr'), null);
  assert.equal(normalizeLocale('__proto__'), null);
});

test('language detection on first use: id-* → id, anything else → en', () => {
  assert.equal(detectLocale('id-ID'), 'id');
  assert.equal(detectLocale('id'), 'id');
  assert.equal(detectLocale('en-US'), 'en');
  assert.equal(detectLocale('fr-FR'), 'en');
  assert.equal(detectLocale(undefined), 'en');
});

test('translate: interpolation, the id locale, falling back to en, then to the key itself', () => {
  assert.equal(tEn('common.save'), 'Save');
  assert.equal(tId('common.save'), 'Simpan');
  assert.equal(tEn('error.workdir-not-found', { path: 'C:\\x' }), 'Folder not found: C:\\x');
  assert.equal(translate('xx', 'common.save'), 'Save');
  assert.equal(tId('no.such.key'), 'no.such.key');
  assert.equal(tEn('error.workdir-not-found'), 'Folder not found: {path}', 'a placeholder with no value is left in place');
});

test('errorMessage: the code is translated with params; with no code or no key yet → err.message', () => {
  const withCode = new ApiRequestError('Folder not found', { code: 'WORKDIR_NOT_FOUND', params: { path: 'E:\\a' } });
  assert.equal(errorMessage(tEn, withCode), 'Folder not found: E:\\a');
  assert.equal(errorMessage(tId, withCode), 'Folder tidak ada: E:\\a');
  assert.equal(errorMessage(tEn, new ApiRequestError('plain message')), 'plain message');
  assert.equal(errorMessage(tEn, new ApiRequestError('raw', { code: 'BRAND_NEW_CODE' })), 'raw');
  assert.equal(kebabFromCode('UPDATE_STALE_MANIFEST'), 'update-stale-manifest');
});

test('ApiRequestError carries code, params, details', () => {
  const e = new ApiRequestError('x', { details: ['a'], code: 'C', params: { n: 1 } });
  assert.deepEqual([e.code, e.params, e.details], ['C', { n: 1 }, ['a']]);
  const bare = new ApiRequestError('y');
  assert.deepEqual([bare.code, bare.params, bare.details], [null, {}, []]);
});

test('every error code required by the spec has a translation in en and id', () => {
  for (const code of ['INTERNAL_ERROR', 'VALIDATION_FAILED', 'NOT_FOUND', 'WORKDIR_NOT_FOUND', 'SOURCE_MISSING', 'REPO_UNAVAILABLE', 'SERVER_UNREACHABLE']) {
    const key = `error.${kebabFromCode(code)}`;
    assert.ok(en[key], `en ${key}`);
    assert.ok(id[key], `id ${key}`);
  }
});

test('the formatters and model messages follow the active language, with no Indonesian strings in en', () => {
  assert.equal(formatTokens(tEn, 1500), '1.5k tokens');
  assert.equal(formatDuration(tEn, 65000), '1m 5s');
  assert.deepEqual(validate({ nodes: [], edges: [] }, []), ['Needs one Start node']);
  const run = reduceRun(emptyRun('r'), { type: 'run_start', workflow: 'wf', ts: 1 });
  assert.equal(run.log[0].text, 'Run started: wf');
  assert.deepEqual(run.log[0].msg, { key: 'logs.event.run-start', params: { workflow: 'wf' } });
  assert.equal(formatDuration(tId, 65000), '1m 5d');
  assert.deepEqual(validate({ nodes: [], edges: [] }, [], tId), ['Butuh satu node Start']);
});

test('i18n:check passes on this repo', () => {
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

test('i18n:check fails: an untranslated key, an identical value, an undefined key', () => {
  const dir = fixture({ 'A.jsx': "export const A = () => <b>{t('a.one')}{t('a.missing')}</b>;\n" });
  const { errors } = runChecks({ en: { 'a.one': 'One', 'a.two': 'Two' }, id: { 'a.one': 'One' }, srcDir: dir, rootDir: dir });
  const text = errors.join('\n');
  assert.match(text, /untranslated key: a\.two/);
  assert.match(text, /value identical to en.*a\.one/);
  assert.match(text, /A\.jsx:1 {2}key missing from en\.json: a\.missing/);
});

test('i18n:check fails: hardcoded text in JSX, in an attribute, in notify, and an Indonesian word', () => {
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
  assert.match(text, /B\.jsx:2 .*attribute/);
  assert.match(text, /B\.jsx:3 .*JSX text/);
  assert.match(text, /B\.jsx:4 .*attribute/);
  assert.match(text, /B\.jsx:7 /);
  assert.match(text, /B\.jsx:8 .*property/);
});

test('i18n:check does not complain about code that already goes through t() or i18n-ignore', () => {
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
