import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json',
};

export function createStaticHandler(distDir) {
  return (req, res, url) => {
    if (!fs.existsSync(distDir)) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('UI belum di-build. Jalankan `npm run build` di folder studio, atau `npm run dev` untuk mode pengembangan.');
      return;
    }
    const requested = path.join(distDir, path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
    const safe = requested.startsWith(distDir) && fs.existsSync(requested) && fs.statSync(requested).isFile();
    const file = safe ? requested : path.join(distDir, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  };
}
