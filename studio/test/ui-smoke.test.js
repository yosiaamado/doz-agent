// Smoke test render: aplikasi harus bisa mount di jsdom (locale en dan id) tanpa render yang melempar.
// Kelas bug yang ditangkap: variabel yang membayangi `t`, hook/context salah pasang, signature formatter yang berubah.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const locale of ['en', 'id']) {
  test(`UI ter-mount tanpa error dan dialog utama bisa dibuka (locale ${locale})`, () => {
    const res = spawnSync(process.execPath, ['scripts/ui-smoke.js', locale], { cwd: STUDIO, encoding: 'utf8', timeout: 120_000 });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, new RegExp(`ui-smoke \\[${locale}\\] OK`));
  });
}
