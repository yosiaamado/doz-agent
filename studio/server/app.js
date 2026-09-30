// Composition root: wires config, repositories, services, runners, and routes into a single HTTP server.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { createConfig } from './infra/config.js';
import { snapshot, changes } from './infra/gitdiff.js';
import { Router } from './http/router.js';
import { assertLocalRequest, readJsonBody } from './http/middleware.js';
import { sendSuccess, sendError } from './http/respond.js';
import { createStaticHandler } from './http/static.js';
import { createSocketHub } from './http/socket.js';
import { createComponentRepository } from './repositories/componentRepository.js';
import { RunRegistry } from './repositories/runLogRepository.js';
import { createWorkflowService } from './services/workflowService.js';
import { createRunService } from './services/runService.js';
import { createUsageService } from './services/usageService.js';
import { createFolderService } from './services/folderService.js';
import { createAttachmentService } from './services/attachmentService.js';
import { createGitService } from './services/gitService.js';
import { logger } from './lib/logger.js';
import { setInjectedApiKey } from './lib/secretEnv.js';
import { createSetupService } from './services/setupService.js';
import { createClaudeCliRunner, claudeVersion } from './runners/claude-cli.js';
import { createApiRunner, apiAvailable, testApiConnection, resetClient } from './runners/api.js';
import { registerSystemRoutes } from './routes/systemRoutes.js';
import { registerLibraryRoutes } from './routes/libraryRoutes.js';
import { registerRunRoutes } from './routes/runRoutes.js';
import { registerGitRoutes } from './routes/gitRoutes.js';
import { registerSetupRoutes } from './routes/setupRoutes.js';
import { registerUpdateRoutes } from './routes/updateRoutes.js';
import { createUpdateService } from './services/updateService.js';

function createRunners({ config, components, usage }) {
  const cli = createClaudeCliRunner({ pluginDir: config.pluginDir, onRateLimit: (info) => usage.recordRateLimit(info) });
  const api = createApiRunner({ listSkills: () => components.list('skills').filter((s) => !s.shadowed) });
  return { 'claude-cli': cli, api };
}

function createRunnerStatus() {
  const version = claudeVersion();
  return () => ({
    'claude-cli': { available: Boolean(version), detail: version ?? 'the `claude` command was not found in PATH', ...(version ? {} : { code: 'CLAUDE_CLI_MISSING' }) },
    api: { available: apiAvailable(), detail: apiAvailable() ? 'ANTHROPIC_API_KEY is set' : 'set ANTHROPIC_API_KEY before starting studio', code: apiAvailable() ? 'API_KEY_PRESENT' : 'API_KEY_NOT_SET' },
  });
}

export function createApp(options = {}) {
  // secretCodec: { encrypt(plain) → string, decrypt(cipher) → string } from Electron safeStorage; absent under `npm start`.
  const config = options.config ?? createConfig({ secretCodec: options.secretCodec });
  // The API key saved through the wizard is used when the environment does not already provide one.
  if (!process.env.ANTHROPIC_API_KEY) {
    const saved = config.savedApiKey();
    if (saved) {
      process.env.ANTHROPIC_API_KEY = saved;
      setInjectedApiKey(saved);
    }
  }
  const components = createComponentRepository(config);
  // probe is called when the user hits refresh, after `runners` has been built.
  const usage = createUsageService({
    usageFile: config.usageFile,
    probe: () => runners['claude-cli'].judge({ prompt: 'Reply: ok', settings: { model: 'haiku' }, workdir: config.getWorkdir(), signal: new AbortController().signal }),
  });
  const runners = options.runners ?? createRunners({ config, components, usage });

  const server = http.createServer();
  const hub = createSocketHub(server);
  const runLog = new RunRegistry({ broadcast: hub.broadcast });
  runLog.watch(config.runsDir());

  const workflows = createWorkflowService({ config, components });
  const attachments = createAttachmentService(config);
  const runs = createRunService({ config, components, workflows, attachments, runLog, runners, tracker: { snapshot, changes } });
  const folders = createFolderService(config);

  const router = new Router();
  const update = createUpdateService({ config, isRunActive: () => runs.hasActive() });
  registerSystemRoutes(router, { config, runLog, runnerStatus: options.runnerStatus ?? createRunnerStatus(), folders, usage, contentVersion: update.contentVersion });
  registerLibraryRoutes(router, { components, workflows });
  registerRunRoutes(router, { config, runs, attachments });
  registerGitRoutes(router, { git: createGitService(config) });
  registerSetupRoutes(router, {
    setup: createSetupService({ config, apiRunner: { testApiConnection, resetClient }, claudeRunner: runners['claude-cli'] }),
  });
  registerUpdateRoutes(router, { update });

  // The web update overlay (S5) is checked per request, so new assets are served immediately without a restart.
  const serveStatic = createStaticHandler(config.webDist, config.webOverlay);
  server.on('request', async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      assertLocalRequest(req);
      if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
      const { handler, params } = router.resolve(req.method, url.pathname);
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJsonBody(req) : undefined;
      const data = await handler({ params, body, query: Object.fromEntries(url.searchParams) });
      return sendSuccess(res, data);
    } catch (err) {
      return sendError(res, err);
    }
  });

  return { server, config, runnerStatus: options.runnerStatus };
}

const HOST = '127.0.0.1';
const PORT_FALLBACK_SPAN = 10; // port, port+1 ... port+9, then a random port from the OS

function listenOnce(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => { server.off('listening', onListening); reject(err); };
    const onListening = () => { server.off('error', onError); resolve(server.address().port); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

async function listenWithFallback(server, wanted) {
  // wanted = 0 means "any port": do not count upward from 1.
  const candidates = wanted > 0 ? Array.from({ length: PORT_FALLBACK_SPAN }, (_, i) => wanted + i).filter((p) => p <= 65535) : [];
  for (const port of [...candidates, 0]) {
    try {
      return await listenOnce(server, port);
    } catch (err) {
      if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') throw err;
    }
  }
  throw new Error('Could not open a local port');
}

// runtime.json is read by the Electron main process to learn which URL to open.
function publishRuntime(config, port) {
  const file = path.join(config.userDataDir, 'runtime.json');
  try {
    fs.mkdirSync(config.userDataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ port, url: `http://${HOST}:${port}`, pid: process.pid, startedAt: Date.now() }));
  } catch (err) {
    logger.warn('could not write runtime.json', { file, error: err?.message });
    return () => {};
  }
  return () => {
    try { fs.rmSync(file, { force: true }); } catch { /* the process is shutting down */ }
  };
}

// Builds the app then listens; if the port is taken it moves to a free one. The UI uses relative URLs, so the new port is automatically correct.
export async function startServer(options = {}) {
  const app = createApp(options);
  const { server, config } = app;
  const wanted = options.port ?? config.port;
  const port = await listenWithFallback(server, wanted);
  if (wanted !== 0 && port !== wanted) logger.warn('port in use, switched to another port', { wanted, port });
  config.port = port;
  const cleanup = publishRuntime(config, port);
  process.once('exit', cleanup);
  server.once('close', () => { cleanup(); process.off('exit', cleanup); });
  return { ...app, server, config, port, url: `http://${HOST}:${port}` };
}
