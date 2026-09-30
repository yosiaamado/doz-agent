// Regression tests for the code review findings (CR-1, CR-3, CR-5, CR-6) that can be checked without a DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import en from '../web/src/i18n/locales/en.json' with { type: 'json' };
import id from '../web/src/i18n/locales/id.json' with { type: 'json' };
import { translate, plural, intlLocale } from '../web/src/i18n/index.js';
import { createLatest } from '../web/src/lib/latest.js';
import { formatTokens, formatDuration, formatTime } from '../web/src/lib/model.js';
import { runChecks } from '../scripts/i18n-check.js';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tEn = (k, v) => translate('en', k, v);
const tId = (k, v) => translate('id', k, v);

test('CR-5: singular/plural forms in en, a single form in id', () => {
  const p = (t, locale, base, n, vars) => plural(t, intlLocale(locale), base, n, vars);
  assert.equal(p(tEn, 'en', 'dialogs.git.files-changed', 1), '1 file changed');
  assert.equal(p(tEn, 'en', 'dialogs.git.files-changed', 2), '2 files changed');
  assert.equal(p(tEn, 'en', 'dialogs.git.files-changed', 0), '0 files changed');
  assert.equal(p(tEn, 'en', 'canvas.metrics.runs', 1), '1 run');
  assert.equal(p(tEn, 'en', 'logs.info.turns', 1), '1 turn');
  assert.equal(p(tEn, 'en', 'dialogs.run.chars', 1, { formatted: '1' }), '1 character');
  assert.equal(p(tEn, 'en', 'dialogs.git.push-message', 1, { branch: 'main', upstream: 'origin/main' }), '1 commit on branch main will be sent to origin/main.');
  assert.equal(p(tId, 'id', 'sidebar.executions.count', 1), '1 run');
  assert.equal(p(tId, 'id', 'sidebar.executions.count', 5), '5 run');
  assert.equal(p(tEn, 'en', 'topbar.issues', 1), '1 issue');
  assert.equal(p(tEn, 'en', 'topbar.issues', 3), '3 issues');
});

test('CR-5: every reviewed plural key has .one and .other in both locales', () => {
  for (const base of ['dialogs.git.files-changed', 'dialogs.git.push-message', 'canvas.metrics.files', 'canvas.metrics.runs', 'dialogs.new-workflow.node-count',
    'dialogs.run.chars', 'logs.info.turns', 'logs.files.summary', 'sidebar.executions.count', 'topbar.issues']) {
    for (const dict of [en, id]) for (const form of ['one', 'other']) assert.ok(dict[`${base}.${form}`], `${base}.${form}`);
    assert.equal(en[base], undefined, `${base} must not be left behind without plural forms`);
  }
});

test('CR-5: i18n:check rejects a plural form that is not paired', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doz-plural-'));
  fs.writeFileSync(path.join(dir, 'A.jsx'), "export const A = () => <b>{tp('n.items', 2)}</b>;\n");
  const { errors } = runChecks({ en: { 'n.items.one': '{count} item' }, id: { 'n.items.one': '{count} butir', 'n.items.other': '{count} butir' }, srcDir: dir, rootDir: dir });
  assert.match(errors.join('\n'), /en\.json {2}incomplete plural form.*n\.items/);
  const ok = runChecks({ en: { 'n.items.one': '{count} item', 'n.items.other': '{count} items' }, id: { 'n.items.one': '{count} butir', 'n.items.other': '{count} butir' }, srcDir: dir, rootDir: dir });
  assert.deepEqual(ok.errors, []);
});

test('CR-6: the formatters use the t/intl they are given, with no global language state', () => {
  // Two languages interleaved in the same process must not affect each other.
  assert.equal(formatTokens(tId, 2500), '2.5k token');
  assert.equal(formatTokens(tEn, 2500), '2.5k tokens');
  assert.equal(formatTokens(tId, 2500), '2.5k token');
  assert.equal(formatDuration(tEn, 5000), '5s');
  assert.equal(formatDuration(tId, 5000), '5d');
  assert.equal(formatDuration(tEn, null), '');
  assert.equal(formatTime('en-US', 0), '');
  const stamp = Date.UTC(2026, 0, 2, 15, 4, 5);
  assert.match(formatTime('en-US', stamp), /\d/);
  assert.equal(formatTime('id-ID', stamp), new Date(stamp).toLocaleTimeString('id-ID', { hour12: false }));
});

test('CR-6: I18nProvider and index.js no longer keep a global locale', () => {
  const provider = fs.readFileSync(path.join(STUDIO, 'web/src/i18n/I18nProvider.jsx'), 'utf8');
  const index = fs.readFileSync(path.join(STUDIO, 'web/src/i18n/index.js'), 'utf8');
  assert.doesNotMatch(provider, /setActiveLocale/);
  assert.doesNotMatch(index, /setActiveLocale|activeLocale/);
});

test('CR-3: createLatest only lets the most recent call write state', () => {
  const latest = createLatest();
  const first = latest.next(); // the refresh from mount
  const second = latest.next(); // the refresh after the check
  assert.equal(first(), false, 'an older response landing later is ignored');
  assert.equal(second(), true);
  latest.cancel(); // unmount
  assert.equal(second(), false);
  assert.equal(latest.next()(), true);
});

function runThemeInit({ theme, locale, language = 'en-US', dark = false, throwing = false }) {
  const root = { dataset: {}, lang: 'en' };
  const storage = { 'doz-studio:theme': theme, 'doz-studio:locale': locale };
  const sandbox = {
    document: { documentElement: root },
    localStorage: { getItem: (k) => { if (throwing) throw new Error('blocked'); return storage[k] ?? null; } },
    matchMedia: () => ({ matches: dark }),
    navigator: { language },
  };
  vm.runInNewContext(fs.readFileSync(path.join(STUDIO, 'web/public/theme-init.js'), 'utf8'), sandbox);
  return root;
}

test('CR-1: theme-init.js sets the theme and lang before render, and index.html has no inline script', () => {
  assert.deepEqual([runThemeInit({ locale: 'id' }).lang, runThemeInit({ locale: 'en' }).lang], ['id', 'en']);
  assert.equal(runThemeInit({ locale: undefined, language: 'id-ID' }).lang, 'id', 'with no stored choice: follow the browser language');
  assert.equal(runThemeInit({ locale: 'xx', language: 'fr-FR' }).lang, 'en');
  assert.equal(runThemeInit({ theme: 'dark' }).dataset.theme, 'dark');
  assert.equal(runThemeInit({ theme: 'system', dark: true }).dataset.theme, 'dark');
  assert.equal(runThemeInit({ theme: 'system', dark: false }).dataset.theme, 'light');
  assert.equal(runThemeInit({ throwing: true }).dataset.theme, 'dark', 'localStorage blocked → dark, and no throw');
  const html = fs.readFileSync(path.join(STUDIO, 'web/index.html'), 'utf8');
  assert.match(html, /<script src="\/theme-init\.js"><\/script>/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script is allowed (CSP script-src self)');
});

test('the key error.update-rollback-incomplete is translated with params', () => {
  const params = { path: 'plugins/a.md', failed: 2, backupDir: 'C:\\b' };
  assert.match(tEn('error.update-rollback-incomplete', params), /2 file\(s\).*plugins\/a\.md.*C:\\b/);
  assert.match(tId('error.update-rollback-incomplete', params), /2 file.*plugins\/a\.md.*C:\\b/);
});
