// Render smoke test: the app must mount in jsdom (locale en and id) without rendering throwing.
// Bug classes this catches: variables shadowing `t`, hooks/context wired up wrong, formatter signatures that changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const locale of ['en', 'id']) {
  test(`the UI mounts without errors and the main dialogs can be opened (locale ${locale})`, () => {
    const res = spawnSync(process.execPath, ['scripts/ui-smoke.js', locale], { cwd: STUDIO, encoding: 'utf8', timeout: 120_000 });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, new RegExp(`ui-smoke \\[${locale}\\] OK`));
  });
}
