// Studio status, the workdir, the source folders, the folder browser, and Claude Code usage.
import { SOURCE_KINDS } from '../infra/config.js';
import { isGitRepo } from '../infra/gitdiff.js';
import { shortName } from '../lib/paths.js';
import { workdirBody, sourcesBody, folderQuery } from '../http/schemas.js';
import fs from 'node:fs';

export function registerSystemRoutes(router, { config, runLog, chatRepo, runnerStatus, folders, usage, contentVersion }) {
  const status = async () => ({
    workdir: config.getWorkdir(),
    workdirName: shortName(config.getWorkdir()),
    repoRoot: config.repoRoot,
    mode: config.mode,
    port: config.port,
    userDataDir: config.userDataDir,
    // Two different numbers: the binary (app) vs. the updatable plugins + web assets (content).
    appVersion: config.appVersion,
    contentVersion: contentVersion(),
    platform: process.platform,
    git: await isGitRepo(config.getWorkdir()),
    runners: runnerStatus(),
  });

  const sourcesInfo = () => Object.fromEntries(SOURCE_KINDS.map((kind) => [kind, config.getSources()[kind].map((entry) => {
    const abs = config.resolveSource(entry);
    return { entry, path: abs, exists: fs.existsSync(abs) };
  })]));

  router
    .get('/api/status', () => status())
    .post('/api/workdir', async ({ body }) => {
      const dir = config.setWorkdir(workdirBody.parse(body).path);
      runLog.watch(config.runsDir());
      chatRepo.watch(config.chatsDir());
      return { ...(await status()), workdir: dir };
    })
    .get('/api/sources', () => sourcesInfo())
    .put('/api/sources', ({ body }) => {
      config.setSources(sourcesBody.parse(body));
      return sourcesInfo();
    })
    .get('/api/folders', ({ query }) => folders.list(folderQuery.parse(query).path))
    .get('/api/usage', () => usage.summary())
    .post('/api/usage/refresh', () => usage.refresh());
}
