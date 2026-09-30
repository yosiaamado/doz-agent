// Pull / commit / push to GitHub from the UI.
import { gitTarget, commitBody } from '../http/schemas.js';

export function registerGitRoutes(router, { git }) {
  const target = (params) => gitTarget.parse(params.target);
  router
    .get('/api/git/:target', ({ params }) => git.status(target(params)))
    .post('/api/git/:target/fetch', ({ params }) => git.fetch(target(params)))
    .post('/api/git/:target/pull', ({ params }) => git.pull(target(params)))
    .post('/api/git/:target/commit', ({ params, body }) => git.commit(target(params), commitBody.parse(body)))
    .post('/api/git/:target/push', ({ params }) => git.push(target(params)));
}
