// The Setup wizard: requirement checks, live tests, and quick fixes (API key, git identity, Claude login).
import { setupTest, apiKeyBody, gitIdentityBody, claudeLoginBody, gitTarget } from '../http/schemas.js';

export function registerSetupRoutes(router, { setup }) {
  router
    .get('/api/setup', () => setup.check())
    .post('/api/setup/test/:name', ({ params, query }) => setup.test(setupTest.parse(params.name), query.target ? gitTarget.parse(query.target) : undefined))
    .put('/api/setup/api-key', ({ body }) => setup.setApiKey(apiKeyBody.parse(body)))
    .delete('/api/setup/api-key', () => setup.clearApiKey())
    .put('/api/setup/git-identity', ({ body }) => setup.setGitIdentity(gitIdentityBody.parse(body)))
    .post('/api/setup/claude-login', ({ body }) => setup.startClaudeLogin(claudeLoginBody.parse(body ?? {})))
    .post('/api/setup/complete', () => setup.complete());
}
