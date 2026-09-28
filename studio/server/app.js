// Composition root: merakit config, repository, service, runner, dan route jadi satu server HTTP.
import http from 'node:http';
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
import { createClaudeCliRunner, claudeVersion } from './runners/claude-cli.js';
import { createApiRunner, apiAvailable } from './runners/api.js';
import { registerSystemRoutes } from './routes/systemRoutes.js';
import { registerLibraryRoutes } from './routes/libraryRoutes.js';
import { registerRunRoutes } from './routes/runRoutes.js';
import { registerGitRoutes } from './routes/gitRoutes.js';

function createRunners({ config, components, usage }) {
  const cli = createClaudeCliRunner({ pluginDir: config.pluginDir, onRateLimit: (info) => usage.recordRateLimit(info) });
  const api = createApiRunner({ listSkills: () => components.list('skills').filter((s) => !s.shadowed) });
  return { 'claude-cli': cli, api };
}

function createRunnerStatus() {
  const version = claudeVersion();
  return () => ({
    'claude-cli': { available: Boolean(version), detail: version ?? 'perintah `claude` tidak ditemukan di PATH' },
    api: { available: apiAvailable(), detail: apiAvailable() ? 'ANTHROPIC_API_KEY terpasang' : 'set ANTHROPIC_API_KEY sebelum menjalankan studio' },
  });
}

export function createApp(options = {}) {
  const config = options.config ?? createConfig();
  const components = createComponentRepository(config);
  // probe dipanggil saat user menekan refresh, setelah `runners` terbentuk.
  const usage = createUsageService({
    usageFile: config.usageFile,
    probe: () => runners['claude-cli'].judge({ prompt: 'Balas: ok', settings: { model: 'haiku' }, workdir: config.getWorkdir(), signal: new AbortController().signal }),
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
  registerSystemRoutes(router, { config, runLog, runnerStatus: options.runnerStatus ?? createRunnerStatus(), folders, usage });
  registerLibraryRoutes(router, { components, workflows });
  registerRunRoutes(router, { config, runs, attachments });
  registerGitRoutes(router, { git: createGitService(config) });

  const serveStatic = createStaticHandler(config.webDist);
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
