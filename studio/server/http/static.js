import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json',
};

// Headers for every static response: block MIME sniffing and URL leaks through Referer.
const BASE_HEADERS = Object.freeze({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });

// Inline scripts (e.g. applying the theme before render) are allowed through a hash of their content, computed from the HTML
// actually served. Once the frontend moves that script into a .js file, the hash disappears on its own and the CSP becomes a plain `script-src 'self'`.
// 'unsafe-inline' is only there for styles, because React uses the style attribute.
export function buildCsp(html) {
  const hashes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// The path separator is required: startsWith(root) alone would let through a sibling folder with the same prefix (dist2).
export function isInsideDir(root, candidate) {
  return candidate === root || candidate.startsWith(root + path.sep);
}

// overlayDir (optional) is searched first per file, then distDir. A missing asset request (one with an extension) gets a 404,
// not index.html: the SPA fallback is only for extensionless routes, so a <script src> never receives HTML.
export function createStaticHandler(distDir, overlayDir = null) {
  const base = path.resolve(distDir);
  const roots = [overlayDir, distDir].filter(Boolean).map((d) => path.resolve(d));
  const findFile = (rel) => {
    for (const root of roots) {
      const candidate = path.join(root, rel);
      if (isInsideDir(root, candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  };
  const notFound = (res) => {
    res.writeHead(404, { ...BASE_HEADERS, 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  };
  return (req, res, url) => {
    if (!fs.existsSync(base) && !findFile('index.html')) {
      res.writeHead(200, { ...BASE_HEADERS, 'content-type': 'text/plain; charset=utf-8' });
      res.end('The UI has not been built. Run `npm run build` in the studio folder, or `npm run dev` for development mode.');
      return;
    }
    let rel = null;
    try {
      rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    } catch {
      // A broken %-encoding: treat it as an ordinary SPA route.
    }
    let file = rel === null ? null : findFile(rel);
    if (!file) {
      if (rel && path.extname(rel)) return notFound(res);
      file = findFile('index.html');
      if (!file) return notFound(res);
    }
    const type = MIME[path.extname(file)] ?? 'application/octet-stream';
    if (path.extname(file) === '.html') {
      const html = fs.readFileSync(file, 'utf8');
      res.writeHead(200, { ...BASE_HEADERS, 'content-type': type, 'content-security-policy': buildCsp(html) });
      res.end(html);
      return;
    }
    res.writeHead(200, { ...BASE_HEADERS, 'content-type': type });
    fs.createReadStream(file).pipe(res);
  };
}
