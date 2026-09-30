// Regression: the static handler must not serve files from a sibling folder whose name starts with the same prefix as distDir.
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
  fs.writeFileSync(path.join(root, 'dist2', 'secret.txt'), 'SECRET');
  fs.writeFileSync(path.join(root, 'outside.txt'), 'OUTSIDE');
  return { root, dist };
}

async function serve(dist) {
  const handler = createStaticHandler(dist);
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, 'http://localhost')));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  // http.request so a raw path (e.g. ..%2f) is not normalized by fetch.
  const get = (rawPath) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: rawPath }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
  return { base, get, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

test('a file inside dist is still served, and an SPA route falls back to index.html', async () => {
  const { dist } = fixture();
  const s = await serve(dist);
  try {
    assert.equal((await s.get('/assets/app.js')).body, 'APP');
    assert.equal((await s.get('/')).body, 'INDEX');
    assert.equal((await s.get('/some/missing/route')).body, 'INDEX');
  } finally { await s.close(); }
});

test('a same-prefix sibling folder (dist2) and a file outside dist cannot be read through ..%2f', async () => {
  const { dist } = fixture();
  const s = await serve(dist);
  try {
    for (const raw of ['/..%2fdist2%2fsecret.txt', '/%2e%2e%2fdist2%2fsecret.txt', '/..%2foutside.txt', '/..%5cdist2%5csecret.txt', '/assets%2f..%2f..%2fdist2%2fsecret.txt']) {
      const res = await s.get(raw);
      assert.notEqual(res.body, 'SECRET', raw);
      assert.notEqual(res.body, 'OUTSIDE', raw);
      assert.equal(res.status, 404, `${raw}: a request with an extension that is not found gets a 404`);
    }
  } finally { await s.close(); }
});

test('a broken % encoding does not cause a server error', async () => {
  const { dist } = fixture();
  const s = await serve(dist);
  try {
    const res = await s.get('/%E0%A4%A');
    assert.equal(res.status, 200);
    assert.equal(res.body, 'INDEX');
  } finally { await s.close(); }
});

test('isInsideDir: a same-prefix sibling folder is rejected, children and the folder itself are accepted', () => {
  const root = path.join(path.sep, 'app', 'dist');
  assert.equal(isInsideDir(root, path.join(root, 'assets', 'a.js')), true);
  assert.equal(isInsideDir(root, root), true);
  assert.equal(isInsideDir(root, path.join(path.sep, 'app', 'dist2', 'secret.txt')), false);
  assert.equal(isInsideDir(root, path.join(path.sep, 'app', 'dist-evil')), false);
  assert.equal(isInsideDir(root, path.join(path.sep, 'app')), false);
});

// SEC-5 + the header side of SEC-4
test('every static response carries nosniff + no-referrer; HTML carries a CSP', async () => {
  const { dist } = fixture();
  fs.writeFileSync(path.join(dist, 'index.html'), '<html><script>var a=1;</script><script type="module" src="/assets/app.js"></script></html>');
  const s = await serve(dist);
  const head = (rawPath) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: Number(new URL(s.base).port), path: rawPath }, (res) => { res.resume(); res.on('end', () => resolve(res.headers)); }).on('error', reject);
  });
  try {
    for (const p of ['/assets/app.js', '/', '/spa/route']) {
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

test('buildCsp: a sha256 hash for inline scripts only; with no inline script, script-src is just self', () => {
  const inline = 'var t=1;';
  const hash = crypto.createHash('sha256').update(inline).digest('base64');
  const withInline = buildCsp('<script>' + inline + '</script><script type="module" src="/a.js"></script>');
  assert.ok(withInline.includes("'sha256-" + hash + "'"));
  assert.equal((withInline.match(/sha256-/g) ?? []).length, 1, 'a script loaded through src is not hashed');
  const clean = buildCsp('<script type="module" src="/a.js"></script>');
  assert.match(clean, /script-src 'self'(;|$)/);
});

// CR-7: a per-file overlay + the SPA fallback for extensionless routes only
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

test('overlay: a file in the overlay wins, and unchanged assets keep being served from the packaged dist (a partial update is safe)', async () => {
  const { root, dist } = fixture();
  const overlay = path.join(root, 'overlay');
  fs.mkdirSync(path.join(overlay, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(overlay, 'index.html'), 'INDEX-V2');
  fs.writeFileSync(path.join(overlay, 'assets', 'new.js'), 'NEW');
  const s = await serveWithOverlay(dist, overlay);
  try {
    assert.equal((await s.get('/')).body, 'INDEX-V2');
    assert.equal((await s.get('/spa/route')).body, 'INDEX-V2');
    assert.equal((await s.get('/assets/new.js')).body, 'NEW');
    assert.equal((await s.get('/assets/app.js')).body, 'APP', 'the older asset from the packaged dist');
  } finally { await s.close(); }
});

test('an overlay without index.html falls back to the dist index; the overlay cannot be used for traversal', async () => {
  const { root, dist } = fixture();
  const overlay = path.join(root, 'overlay');
  fs.mkdirSync(overlay);
  fs.writeFileSync(path.join(root, 'secret-overlay.txt'), 'SECRET-OVERLAY');
  const s = await serveWithOverlay(dist, overlay);
  try {
    assert.equal((await s.get('/')).body, 'INDEX');
    assert.equal((await s.get('/..%2fsecret-overlay.txt')).status, 404);
  } finally { await s.close(); }
});

test('a missing asset with an extension → 404 text/plain (not an index.html served as text/html); SPA routes still get index.html', async () => {
  const { dist } = fixture();
  const s = await serveWithOverlay(dist, null);
  try {
    const missingJs = await s.get('/assets/missing.js');
    assert.equal(missingJs.status, 404);
    assert.doesNotMatch(missingJs.type, /html/);
    assert.notEqual(missingJs.body, 'INDEX');
    assert.equal((await s.get('/dashboard')).body, 'INDEX');
  } finally { await s.close(); }
});
