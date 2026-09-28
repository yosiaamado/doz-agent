// doz-studio: server lokal (127.0.0.1) untuk editor visual workflow + runner.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { PORT, REPO_ROOT, STUDIO_DIR, WORKFLOWS_DIR, getWorkdir, setWorkdir } from './config.js';
import { listAgents, listSkills } from './agents.js';
import { parseWorkflow, serializeWorkflow, validateWorkflow, normalize } from './workflow.js';
import { WorkflowRun } from './engine.js';
import { RunRegistry } from './runs.js';
import { claudeCliRunner, claudeAvailable } from './runners/claude-cli.js';
import { apiRunner, apiAvailable } from './runners/api.js';

const runners = { 'claude-cli': claudeCliRunner, api: apiRunner };
const WEB_DIST = path.join(STUDIO_DIR, 'web', 'dist');
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const sockets = new Set();
const broadcast = (msg) => {
  const data = JSON.stringify(msg);
  for (const ws of sockets) if (ws.readyState === 1) ws.send(data);
};
const registry = new RunRegistry({ broadcast });
registry.watch(getWorkdir());

const claudeVersion = claudeAvailable();

function hostOk(req) {
  const host = (req.headers.host ?? '').replace(/:\d+$/, '');
  if (!LOCAL_HOSTS.has(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname) || LOCAL_HOSTS.has(`[${new URL(origin).hostname}]`);
  } catch {
    return false;
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 5_000_000) throw new Error('body terlalu besar');
  }
  return data ? JSON.parse(data) : {};
}

function workflowFile(name) {
  if (!NAME_RE.test(name)) throw Object.assign(new Error('nama workflow hanya boleh huruf, angka, - dan _'), { status: 400 });
  return path.join(WORKFLOWS_DIR, `${name}.md`);
}

function listWorkflows() {
  if (!fs.existsSync(WORKFLOWS_DIR)) return [];
  return fs.readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => {
      const name = path.basename(f, '.md');
      try {
        const wf = parseWorkflow(fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8'), name);
        return { name, description: wf.description, nodes: wf.nodes.length };
      } catch (err) {
        return { name, description: `⚠ ${err.message}`, nodes: 0 };
      }
    });
}

function status() {
  return {
    workdir: getWorkdir(),
    repoRoot: REPO_ROOT,
    runners: {
      'claude-cli': { available: Boolean(claudeVersion), detail: claudeVersion ?? 'perintah `claude` tidak ditemukan di PATH' },
      api: { available: apiAvailable(), detail: apiAvailable() ? 'ANTHROPIC_API_KEY terpasang' : 'set ANTHROPIC_API_KEY sebelum menjalankan studio' },
    },
  };
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // buang "api"
  const method = req.method;
  const [a, b, c] = parts;

  if (a === 'status' && method === 'GET') return send(res, 200, status());
  if (a === 'workdir' && method === 'POST') {
    const body = await readBody(req);
    const dir = setWorkdir(body.path);
    registry.watch(dir);
    return send(res, 200, status());
  }
  if (a === 'agents' && method === 'GET') return send(res, 200, listAgents());
  if (a === 'skills' && method === 'GET') return send(res, 200, listSkills());

  if (a === 'workflows') {
    if (!b && method === 'GET') return send(res, 200, listWorkflows());
    const file = workflowFile(b);
    if (method === 'GET') {
      if (!fs.existsSync(file)) return send(res, 404, { error: 'workflow tidak ada' });
      const wf = parseWorkflow(fs.readFileSync(file, 'utf8'), b);
      return send(res, 200, { workflow: wf, errors: validateWorkflow(wf, listAgents().map((x) => x.name)) });
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      const wf = normalize({ ...body.workflow, name: b }, b);
      fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
      fs.writeFileSync(file, serializeWorkflow(wf));
      return send(res, 200, { workflow: wf, errors: validateWorkflow(wf, listAgents().map((x) => x.name)), file: path.relative(REPO_ROOT, file) });
    }
    if (method === 'DELETE') {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return send(res, 200, { ok: true });
    }
  }

  if (a === 'runs') {
    if (!b && method === 'GET') return send(res, 200, registry.list());
    if (!b && method === 'POST') {
      const body = await readBody(req);
      const agents = listAgents();
      const wf = body.workflow
        ? normalize(body.workflow)
        : parseWorkflow(fs.readFileSync(workflowFile(body.name), 'utf8'), body.name);
      const errors = validateWorkflow(wf, agents.map((x) => x.name));
      if (errors.length) return send(res, 400, { error: 'workflow belum valid', errors });
      const id = `${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')}-${crypto.randomBytes(2).toString('hex')}`;
      const run = new WorkflowRun({
        id, wf, agents, input: String(body.input ?? ''), workdir: getWorkdir(), runners,
        emit: (ev) => registry.record({ source: 'studio', ...ev }),
      });
      registry.create(id, wf.name, run);
      run.start().catch((err) => console.error(err));
      return send(res, 200, { id });
    }
    if (b && !c && method === 'GET') {
      const events = registry.events(b);
      return events ? send(res, 200, { id: b, events }) : send(res, 404, { error: 'run tidak ada' });
    }
    const run = registry.runs.get(b)?.run;
    if (!run) return send(res, 404, { error: 'run tidak aktif di studio ini' });
    if (c === 'stop' && method === 'POST') { run.stop(); return send(res, 200, { ok: true }); }
    if (c === 'approve' && method === 'POST') {
      const body = await readBody(req);
      run.approve(body.node, Boolean(body.approved), body.note ?? '');
      return send(res, 200, { ok: true });
    }
  }
  return send(res, 404, { error: 'tidak ditemukan' });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function serveStatic(req, res, url) {
  if (!fs.existsSync(WEB_DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('UI belum di-build. Jalankan `npm run build` di folder studio, atau `npm run dev` untuk mode pengembangan.');
  }
  let file = path.join(WEB_DIST, path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
  if (!file.startsWith(WEB_DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!hostOk(req)) return send(res, 403, { error: 'hanya boleh diakses dari localhost' });
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  try {
    await handleApi(req, res, url);
  } catch (err) {
    send(res, err.status ?? 500, { error: err.message });
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (!hostOk(req) || !req.url.startsWith('/ws')) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    sockets.add(ws);
    ws.on('close', () => sockets.delete(ws));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`doz-studio jalan di http://localhost:${PORT}`);
  console.log(`workdir  : ${getWorkdir()}`);
  console.log(`runner   : claude-cli ${claudeVersion ? `✓ ${claudeVersion}` : '✗'} | api ${apiAvailable() ? '✓' : '✗ (ANTHROPIC_API_KEY belum di-set)'}`);
});
