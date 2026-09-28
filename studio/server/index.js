// doz-studio: server lokal (127.0.0.1) untuk editor visual workflow + runner.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
  PORT, REPO_ROOT, STUDIO_DIR, SOURCE_KINDS, getWorkdir, setWorkdir, getSources, setSources, resolveSource, primaryDir,
} from './config.js';
import {
  NAME_RE, listAgents, listSkills, listActions, listWorkflowFiles, readItem, updateItem, createItem,
} from './library.js';
import { parseWorkflow, serializeWorkflow, validateWorkflow, normalize } from './workflow.js';
import { WorkflowRun } from './engine.js';
import { RunRegistry } from './runs.js';
import { snapshot, changes, fileDiff, isGitRepo } from './gitdiff.js';
import { claudeCliRunner, claudeAvailable } from './runners/claude-cli.js';
import { apiRunner, apiAvailable } from './runners/api.js';

const runners = { 'claude-cli': claudeCliRunner, api: apiRunner };
const WEB_DIST = path.join(STUDIO_DIR, 'web', 'dist');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const LISTS = { agents: listAgents, skills: listSkills, actions: listActions };

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
    return LOCAL_HOSTS.has(new URL(origin).hostname);
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

const httpError = (status, message) => Object.assign(new Error(message), { status });

function workflowPath(name, { create = false } = {}) {
  if (!NAME_RE.test(name ?? '')) throw httpError(400, 'nama workflow hanya boleh huruf, angka, - dan _');
  const existing = listWorkflowFiles().find((w) => w.name === name && !w.shadowed);
  if (existing) return existing.path;
  if (!create) throw httpError(404, `workflow "${name}" tidak ada`);
  return path.join(primaryDir('workflows'), `${name}.md`);
}

function listWorkflows() {
  return listWorkflowFiles().filter((w) => !w.shadowed).map((w) => {
    try {
      const wf = parseWorkflow(fs.readFileSync(w.path, 'utf8'), w.name);
      return { name: w.name, file: w.file, description: wf.description, nodes: wf.nodes.length };
    } catch (err) {
      return { name: w.name, file: w.file, description: `⚠ ${err.message}`, nodes: 0 };
    }
  });
}

async function status() {
  return {
    workdir: getWorkdir(),
    repoRoot: REPO_ROOT,
    git: await isGitRepo(getWorkdir()),
    runners: {
      'claude-cli': { available: Boolean(claudeVersion), detail: claudeVersion ?? 'perintah `claude` tidak ditemukan di PATH' },
      api: { available: apiAvailable(), detail: apiAvailable() ? 'ANTHROPIC_API_KEY terpasang' : 'set ANTHROPIC_API_KEY sebelum menjalankan studio' },
    },
  };
}

function sourcesInfo() {
  const sources = getSources();
  const out = {};
  for (const kind of SOURCE_KINDS) {
    out[kind] = sources[kind].map((entry) => {
      const abs = resolveSource(entry);
      const exists = fs.existsSync(abs);
      return { entry, path: abs, exists };
    });
  }
  return out;
}

async function handleApi(req, res, url) {
  const [a, b, c, d] = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
  const method = req.method;

  if (a === 'status' && method === 'GET') return send(res, 200, await status());
  if (a === 'workdir' && method === 'POST') {
    const body = await readBody(req);
    const dir = setWorkdir(body.path);
    registry.watch(dir);
    return send(res, 200, await status());
  }

  // Folder sumber komponen
  if (a === 'sources') {
    if (method === 'GET') return send(res, 200, sourcesInfo());
    if (method === 'PUT') {
      setSources(await readBody(req));
      return send(res, 200, sourcesInfo());
    }
  }

  // Komponen: /api/library/:kind[/:name]
  if (a === 'library') {
    if (!LISTS[b]) throw httpError(404, 'jenis tidak dikenal');
    if (!c && method === 'GET') return send(res, 200, LISTS[b]().map(({ prompt, ...rest }) => rest));
    if (!c && method === 'POST') return send(res, 200, createItem(b, await readBody(req)));
    if (c && method === 'GET') return send(res, 200, readItem(b, c));
    if (c && method === 'PUT') return send(res, 200, updateItem(b, c, await readBody(req)));
  }

  if (a === 'workflows') {
    if (!b && method === 'GET') return send(res, 200, listWorkflows());
    if (method === 'GET') {
      const file = workflowPath(b);
      const wf = parseWorkflow(fs.readFileSync(file, 'utf8'), b);
      return send(res, 200, { workflow: wf, errors: validateWorkflow(wf, listAgents().map((x) => x.name)) });
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      const file = workflowPath(b, { create: true });
      const wf = normalize({ ...body.workflow, name: b }, b);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, serializeWorkflow(wf));
      return send(res, 200, { workflow: wf, errors: validateWorkflow(wf, listAgents().map((x) => x.name)), file: path.relative(REPO_ROOT, file) });
    }
  }

  // Diff satu file (atau semua) antara dua snapshot node. Dipanggil saat user memilih file.
  if (a === 'diff' && method === 'GET') {
    const text = await fileDiff(getWorkdir(), url.searchParams.get('base'), url.searchParams.get('head'), url.searchParams.get('file'));
    return send(res, 200, { diff: text });
  }

  if (a === 'runs') {
    if (!b && method === 'GET') return send(res, 200, registry.list());
    if (!b && method === 'POST') {
      const body = await readBody(req);
      const agents = listAgents().filter((x) => !x.shadowed);
      const wf = body.workflow
        ? normalize(body.workflow)
        : parseWorkflow(fs.readFileSync(workflowPath(body.name), 'utf8'), body.name);
      const errors = validateWorkflow(wf, agents.map((x) => x.name));
      if (errors.length) return send(res, 400, { error: 'workflow belum valid', errors });
      const id = `${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')}-${crypto.randomBytes(2).toString('hex')}`;
      const run = new WorkflowRun({
        id, wf, agents, actions: listActions().filter((x) => !x.shadowed),
        input: String(body.input ?? ''), workdir: getWorkdir(), runners,
        tracker: { snapshot, changes },
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
  void d;
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
