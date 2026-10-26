// Derives the Office roster (one entry per agent) from the library, the followed run and the chats.
import { emptyActivity } from './activity.js';

export const PINNED_AGENT = 'technical-lead';

const nameOf = (a) => (typeof a === 'string' ? a : a?.name);

export function defaultChatAgent(agents) {
  const names = (agents ?? []).map(nameOf).filter(Boolean);
  if (names.includes(PINNED_AGENT)) return PINNED_AGENT;
  return [...names].sort((a, b) => a.localeCompare(b))[0] ?? null;
}

function chatList(chats) {
  const list = Array.isArray(chats) ? chats : chats?.chats ?? [];
  return [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function deriveOffice({ agents, run, chats }) {
  const list = chatList(chats);
  const selected = Array.isArray(chats) ? null : chats?.selected ?? null;
  const selectedId = Array.isArray(chats) ? null : chats?.selectedId ?? selected?.chat?.id ?? null;
  const streamOf = (chat) => chats?.streams?.[chat.id] ?? chat.stream ?? (selected?.chat?.id === chat.id ? selected.stream : null);
  const runNodes = run?.status === 'running'
    ? (run.order ?? []).map((id) => [id, run.nodes?.[id]]).filter(([, n]) => n?.status === 'running')
    : [];

  const roster = (agents ?? []).map((raw) => {
    const name = nameOf(raw);
    const nodeEntry = runNodes.find(([, n]) => n.agent === name);
    const mine = list.filter((c) => c.agent === name);
    const running = mine.find((c) => c.id === selectedId && c.status === 'running') ?? mine.find((c) => c.status === 'running') ?? null;
    const chat = mine.find((c) => c.id === selectedId) ?? running ?? mine[0] ?? null;
    const chatRunning = Boolean(running);
    const status = nodeEntry ? 'running' : chatRunning ? 'chatting' : 'idle';
    const stream = (nodeEntry ? nodeEntry[1].stream : chatRunning ? streamOf(running) : null) ?? emptyActivity();
    return {
      name,
      description: typeof raw === 'string' ? '' : raw.description ?? '',
      pinned: name === PINNED_AGENT,
      status,
      node: nodeEntry ? { id: nodeEntry[0], label: nodeEntry[1].label || nodeEntry[0] } : null,
      activity: stream.current ?? '',
      next: nodeEntry ? nodeEntry[1].next ?? [] : [],
      todos: stream.todos ?? [],
      subagents: stream.subagents ?? {},
      stream,
      chatId: chat?.id ?? null,
    };
  });
  return roster.sort((a, b) => (a.pinned === b.pinned ? a.name.localeCompare(b.name) : a.pinned ? -1 : 1));
}
