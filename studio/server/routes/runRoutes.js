// Run workflow, persetujuan, lampiran, dan diff file per node.
import { startRunBody, approveBody, attachmentBody, diffQuery } from '../http/schemas.js';
import { fileDiff } from '../infra/gitdiff.js';

export function registerRunRoutes(router, { config, runs, attachments }) {
  router
    .get('/api/runs', () => runs.list())
    .post('/api/runs', ({ body }) => runs.start(startRunBody.parse(body)))
    .get('/api/runs/:id', ({ params }) => runs.events(params.id))
    .post('/api/runs/:id/stop', ({ params }) => runs.stop(params.id))
    .post('/api/runs/:id/approve', ({ params, body }) => runs.approve(params.id, approveBody.parse(body)))
    .post('/api/attachments', ({ body }) => attachments.save(attachmentBody.parse(body)))
    .get('/api/diff', async ({ query }) => {
      const { base, head, file } = diffQuery.parse(query);
      return { diff: await fileDiff(config.getWorkdir(), base, head, file) };
    });
}
