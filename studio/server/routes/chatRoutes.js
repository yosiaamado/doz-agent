// Agent chats: list, create, messages, retry, edit permission, delete.
import { chatCreateBody, chatMessageBody, chatUpdateBody } from '../http/schemas.js';

export function registerChatRoutes(router, { chats }) {
  router
    .get('/api/chats', () => chats.list())
    .post('/api/chats', ({ body }) => chats.create(chatCreateBody.parse(body ?? {})))
    .get('/api/chats/:id', ({ params }) => chats.get(params.id))
    .post('/api/chats/:id/messages', ({ params, body }) => chats.send(params.id, chatMessageBody.parse(body ?? {})))
    .post('/api/chats/:id/retry', ({ params }) => chats.retry(params.id))
    .put('/api/chats/:id', ({ params, body }) => chats.update(params.id, chatUpdateBody.parse(body ?? {})))
    .delete('/api/chats/:id', ({ params }) => chats.remove(params.id));
}
