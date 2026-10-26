// Chats with an agent: one `claude -p` process per turn, resumed through the session id the first turn reported.
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { SESSION_ID } from '../repositories/chatRepository.js';

const MAX_TITLE = 60;
const MAX_ERROR = 500;

const titleOf = (text) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);

export function createChatService({ config, components, profiles, chatRepo, runner }) {
  // chat id → AbortController of the turn that is running.
  const active = new Map();

  const requireChat = (id) => chatRepo.get(id) ?? (() => { throw notFound('Chat not found', { code: 'CHAT_NOT_FOUND' }); })();
  const assertIdle = (id) => {
    if (active.has(id)) throw conflict('The agent is still working on the previous message', { code: 'CHAT_TURN_ACTIVE' });
  };
  const findAgent = (name) => components.list('agents').find((a) => a.name === name && !a.shadowed)
    ?? (() => { throw notFound(`Agent "${name}" not found`, { code: 'CHAT_AGENT_NOT_FOUND', params: { agent: name } }); })();
  const spawnFor = (chat) => {
    try {
      return profiles.spawnContext(chat.profileId);
    } catch (err) {
      if (err.code === 'PROFILE_NOT_FOUND') throw conflict('The profile of this chat was deleted', { code: 'CHAT_PROFILE_GONE' });
      throw err;
    }
  };

  function startTurn(chat, text, retryOf) {
    const id = chat.id;
    const agent = findAgent(chat.agent);
    const spawn = spawnFor(chat);
    const turn = chat.turns + 1;
    const controller = new AbortController();
    const message = { id: `${id}:${turn}:user`, turn, role: 'user', text, ts: Date.now(), ...(retryOf ? { retryOf } : {}) };
    chatRepo.append(id, { type: 'chat_turn_start', chat: id, turn, message, ...(chat.title ? {} : { title: titleOf(text) }) });
    active.set(id, controller);

    const onActivity = (a) => {
      try {
        if (!chatRepo.get(id)) return;
        chatRepo.append(id, { ...a, type: 'activity', chat: id, turn });
        if (a.kind === 'init' && SESSION_ID.test(String(a.init?.sessionId)) && chatRepo.get(id)?.sessionId === null) {
          chatRepo.append(id, { type: 'chat_updated', patch: { sessionId: a.init.sessionId } });
        }
      } catch (err) {
        logger.warn('chat activity could not be recorded', { chat: id, error: err?.message });
      }
    };
    const current = chatRepo.get(id);
    new Promise((resolve) => resolve(runner.chat({
      agent, text, sessionId: current.sessionId, resume: current.sessionId !== null, allowEdits: current.allowEdits,
      workdir: current.workdir, env: spawn.cliEnv, profileId: spawn.profileId, signal: controller.signal, onActivity,
    }))).then(
      (res) => finish(id, turn, { status: 'done', cost: res.cost ?? 0, usage: res.usage ?? null, sessionId: res.sessionId ?? null,
        message: { id: `${id}:${turn}:assistant`, turn, role: 'assistant', text: res.output ?? '', ts: Date.now(), cost: res.cost ?? 0 } }),
      (err) => finish(id, turn, { status: 'failed', cost: 0, usage: null, sessionId: null,
        message: { id: `${id}:${turn}:error`, turn, role: 'error', text: String(err?.message ?? err).slice(0, MAX_ERROR), ts: Date.now(), errorCode: 'CHAT_TURN_FAILED' } }),
    );
    return { chat: chatRepo.get(id), turn };
  }

  function finish(id, turn, end) {
    active.delete(id);
    try {
      if (!chatRepo.get(id)) return;
      const sessionId = SESSION_ID.test(String(end.sessionId)) ? end.sessionId : null;
      chatRepo.append(id, { type: 'chat_turn_end', chat: id, turn, ...end, sessionId: sessionId ?? chatRepo.get(id).sessionId });
    } catch (err) {
      logger.error('chat turn end could not be recorded', { chat: id, turn, error: err?.message });
    }
  }

  return {
    list: () => chatRepo.list(),
    hasActive: () => active.size > 0,
    isActive: (id) => active.has(id),
    create({ agent, allowEdits = false }) {
      findAgent(agent);
      const profile = profiles.active();
      let id;
      do { id = `c_${crypto.randomBytes(4).toString('hex')}`; } while (chatRepo.get(id));
      const now = Date.now();
      return chatRepo.create({
        id, agent, title: '', profileId: profile.id, configDir: profile.configDir ?? null, workdir: config.getWorkdir(), allowEdits: Boolean(allowEdits),
        sessionId: null, status: 'idle', turns: 0, cost: 0, createdAt: now, updatedAt: now,
      });
    },
    get(id) {
      const chat = requireChat(id);
      return { chat, messages: chatRepo.messages(id), activity: chatRepo.lastTurnActivity(id) };
    },
    send(id, { text }) {
      const chat = requireChat(id);
      if (!text.trim()) throw badRequest('Write a message first', { code: 'CHAT_MESSAGE_EMPTY' });
      assertIdle(id);
      return startTurn(chat, text, undefined);
    },
    retry(id) {
      const chat = requireChat(id);
      assertIdle(id);
      const last = chatRepo.messages(id).findLast((m) => m.role === 'user');
      if (chat.status !== 'failed' || !last) throw badRequest('There is no failed turn to retry', { code: 'CHAT_NOTHING_TO_RETRY' });
      return startTurn(chat, last.text, chat.turns);
    },
    update(id, { allowEdits }) {
      requireChat(id);
      assertIdle(id);
      chatRepo.append(id, { type: 'chat_updated', patch: { allowEdits } });
      return chatRepo.get(id);
    },
    remove(id) {
      const chat = requireChat(id);
      assertIdle(id);
      let configDir;
      try {
        configDir = path.dirname(profiles.spawnContext(chat.profileId).projectsDir);
      } catch {
        configDir = chat.configDir ?? path.join(os.homedir(), '.claude');
      }
      chatRepo.remove(id);
      return { deleted: true, transcriptKept: true, configDir };
    },
  };
}
