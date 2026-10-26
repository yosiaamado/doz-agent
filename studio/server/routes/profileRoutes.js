// Claude account profiles: list, create, rename, delete, switch, API key, login status and login.
import { profileCreateBody, profileUpdateBody, profileActiveBody, profileLoginBody, apiKeyBody } from '../http/schemas.js';

export function registerProfileRoutes(router, { profiles }) {
  router
    .get('/api/profiles', () => profiles.list())
    .post('/api/profiles', ({ body }) => profiles.create(profileCreateBody.parse(body)))
    .post('/api/profiles/active', ({ body }) => profiles.setActive(profileActiveBody.parse(body).id))
    .put('/api/profiles/:id', ({ params, body }) => profiles.update(params.id, profileUpdateBody.parse(body)))
    .delete('/api/profiles/:id', ({ params }) => profiles.remove(params.id))
    .put('/api/profiles/:id/api-key', ({ params, body }) => profiles.setKey(params.id, apiKeyBody.parse(body)))
    .delete('/api/profiles/:id/api-key', ({ params }) => profiles.clearKey(params.id))
    .get('/api/profiles/:id/auth', ({ params }) => profiles.auth(params.id))
    .post('/api/profiles/:id/login', ({ params, body }) => profiles.login(params.id, profileLoginBody.parse(body ?? {})));
}
