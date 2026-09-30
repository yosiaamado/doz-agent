// Regresi: handler static tidak boleh menyajikan file dari folder bersaudara yang namanya berawalan sama dengan distDir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createStaticHandler, isInsideDir, buildCsp } from '../server/http/static.js';

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doz-static-')));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), 'INDEX');
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'APP');
  fs.mkdirSync(path.join(root, 'dist2'));
  fs.writeFileSync(path.join(root, 'dist2', 'secret.txt'), 'RAHASIA');
  fs.writeFileSync(path.join(root, 'outside.txt'), 'DI-LUAR');
  return { root, dist };
}

async function serve(dist) {
  const handler = createStaticHandler(dist);
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost')));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // http.request agar path mentah (mis. ..%2f) tidak dinormalisasi oleh fetch.
  const get = (rawPath) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: rawPath }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
  return { base, get, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

test('file di dalam dist tetap dilayani, rute SPA jatuh ke index.html', async () => {
  const { dist } = fixture();
  const s = await serve(dist);
  try {
    assert.equal((await s.get('/assets/app.js')).body, 'APP');
    assert.equal((await s.get('/')).body, 'INDEX');
    assert.equal((await s.get('/rute/tidak/ada')).body, 'INDEX');
  } finally { await s.close(); }
});

test('folder bersaudara berawalan sama (dist2) dan file di luar dist tidak bisa dibaca lewat ..%2f', async () => {
  const { dist } = fixture();
  const s = await serve(dist);
  try {
    for (const raw of ['/..%2fdist2%2fsecret.txt', '/%2e%2e%2fdist2%2fsecret.txt', '/..%2foutside.txt', '/..%5cdist2%5csecret.txt', '/assets%2f..%2f..%2fdist2%2fsecret.txt']) {
      const res = await s.get(raw);
      assert.notEqual(res.body, 'RAHASIA', raw);
      assert.notEqual(res.body, 'DI-LUAR', raw);
      assert.equal(res.status, 404, `${raw}: permintaan berekstensi yang tidak ditemukan dijawab 404`);
    }
  } finally { await s.close(); }
});

test('encoding % rusak tidak membuat server error', async () => {
  const { dist } = fixture();
  const s = await serve(dist);
  try {
    const res = await s.get('/%E0%A4%A');
    assert.equal(res.status, 200);
    assert.equal(res.body, 'INDEX');
  } finally { await s.close(); }
});

test('isInsideDir: folder bersaudara berawalan sama ditolak, anak dan dirinya sendiri diterima', () => {
  const root = path.join(path.sep, 'app', 'dist');
  assert.equal(isInsideDir(root, path.join(root, 'assets', 'a.js')), true);
  assert.equal(isInsideDir(root, root), true);
  assert.equal(isInsideDir(root, path.join(path.sep, 'app', 'dist2', 'secret.txt')), false);
  assert.equal(isInsideDir(root, path.join(path.sep, 'app', 'dist-evil')), false);
  assert.equal(isInsideDir(root, path.join(path.sep, 'app')), false);
});

// SEC-5 + sisi header SEC-4
test('semua respons statis membawa nosniff + no-referrer; HTML membawa CSP', async () => {
  const { dist } = fixture();
  fs.writeFileSync(path.join(dist, 'index.html'), '<html><script>var a=1;</script><script type="module" src="/assets/app.js"></script></html>');
  const s = await serve(dist);
  const head = (rawPath) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: Number(new URL(s.base).port), path: rawPath }, (res) => { res.resume(); res.on('end', () => resolve(res.headers)); }).on('error', reject);
  });
  try {
    for (const p of ['/assets/app.js', '/', '/rute/spa']) {
      const h = await head(p);
      assert.equal(h['x-content-type-options'], 'nosniff', p);
      assert.equal(h['referrer-policy'], 'no-referrer', p);
    }
    assert.equal((await head('/assets/app.js'))['content-security-policy'], undefined);
    const csp = (await head('/'))['content-security-policy'];
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  } finally { await s.close(); }
});

test('buildCsp: hash sha256 untuk skrip inline saja; tanpa skrip inline, script-src hanya self', () => {
  const inline = 'var t=1;';
  const hash = crypto.createHash('sha256').update(inline).digest('base64');
  const withInline = buildCsp('<script>' + inline + '</script><script type="module" src="/a.js"></script>');
  assert.ok(withInline.includes("'sha256-" + hash + "'"));
  assert.equal((withInline.match(/sha256-/g) ?? []).length, 1, 'skrip bersumber src tidak di-hash');
  const clean = buildCsp('<script type="module" src="/a.js"></script>');
  assert.match(clean, /script-src 'self'(;|$)/);
});

// CR-7: overlay per file + fallback SPA hanya untuk rute tanpa ekstensi
async function serveWithOverlay(dist, overlay) {
  const handler = createStaticHandler(dist, overlay);
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost')));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const get = (p) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: p }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body, type: res.headers['content-type'] }));
    }).on('error', reject);
  });
  return { get, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

test('overlay: file di overlay menang, aset yang tidak berubah tetap dilayani dari dist terpaket (update parsial aman)', async () => {
  const { root, dist } = fixture();
  const overlay = path.join(root, 'overlay');
  fs.mkdirSync(path.join(overlay, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(overlay, 'index.html'), 'INDEX-V2');
  fs.writeFileSync(path.join(overlay, 'assets', 'new.js'), 'NEW');
  const s = await serveWithOverlay(dist, overlay);
  try {
    assert.equal((await s.get('/')).body, 'INDEX-V2');
    assert.equal((await s.get('/rute/spa')).body, 'INDEX-V2');
    assert.equal((await s.get('/assets/new.js')).body, 'NEW');
    assert.equal((await s.get('/assets/app.js')).body, 'APP', 'aset lama dari dist terpaket');
  } finally { await s.close(); }
});

test('overlay tanpa index.html jatuh ke index dist; overlay tidak bisa dipakai untuk traversal', async () => {
  const { root, dist } = fixture();
  const overlay = path.join(root, 'overlay');
  fs.mkdirSync(overlay);
  fs.writeFileSync(path.join(root, 'secret-overlay.txt'), 'RAHASIA-OVERLAY');
  const s = await serveWithOverlay(dist, overlay);
  try {
    assert.equal((await s.get('/')).body, 'INDEX');
    assert.equal((await s.get('/..%2fsecret-overlay.txt')).status, 404);
  } finally { await s.close(); }
});

test('aset berekstensi yang tidak ada → 404 text/plain (bukan index.html berisi text/html); rute SPA tetap index.html', async () => {
  const { dist } = fixture();
  const s = await serveWithOverlay(dist, null);
  try {
    const missingJs = await s.get('/assets/hilang.js');
    assert.equal(missingJs.status, 404);
    assert.doesNotMatch(missingJs.type, /html/);
    assert.notEqual(missingJs.body, 'INDEX');
    assert.equal((await s.get('/dashboard')).body, 'INDEX');
  } finally { await s.close(); }
});
