// The normalized activity stream (runs and chats share it): top-level lines, subagent groups with their own lines, todos, init and rate limit.
export const MAX_LINES = 300;
export const MAX_GROUP_LINES = 200;

export function emptyActivity() {
  return { lines: [], subagents: {}, order: [], todos: [], init: null, rateLimit: null, sessionId: null, current: '', seq: 0 };
}

const cap = (list, max) => (list.length > max ? list.slice(list.length - max) : list);

export function hasActivity(s) {
  return Boolean(s && (s.lines.length || s.order.length || s.todos.length || s.init || s.rateLimit));
}

export function reduceActivity(state, ev) {
  const s = state ?? emptyActivity();
  const base = { ...s, current: ev.text ?? s.current, seq: s.seq + 1 };
  switch (ev.kind) {
    case 'init': {
      const init = ev.init ?? { model: ev.model ?? null, sessionId: ev.session ?? null };
      return { ...base, init, sessionId: init.sessionId ?? ev.session ?? s.sessionId };
    }
    case 'todo':
      return { ...base, todos: Array.isArray(ev.todos) ? ev.todos : s.todos };
    case 'rate_limit':
      return { ...base, rateLimit: ev.rateLimit ?? null };
    case 'subagent_start': {
      const id = ev.toolUseId;
      if (!id || Object.hasOwn(s.subagents, id)) return base;
      // A group nests only under a group that already exists: parents are always older, so nesting cannot loop.
      const parentId = ev.parentId && ev.parentId !== id && Object.hasOwn(s.subagents, ev.parentId) ? ev.parentId : null;
      const group = { agent: ev.agent ?? 'general-purpose', text: ev.text ?? '', status: 'running', lines: [], parentId };
      return { ...base, subagents: { ...s.subagents, [id]: group }, order: parentId ? s.order : [...s.order, id] };
    }
    case 'subagent_end': {
      const group = ev.toolUseId && Object.hasOwn(s.subagents, ev.toolUseId) ? s.subagents[ev.toolUseId] : null;
      if (!group) return base;
      return { ...base, subagents: { ...s.subagents, [ev.toolUseId]: { ...group, status: ev.isError ? 'failed' : 'done' } } };
    }
    default: {
      const line = { id: `${ev.toolUseId ?? ev.kind ?? 'line'}:${s.seq}`, kind: ev.kind ?? 'text', text: ev.text ?? '', tool: ev.tool, ts: ev.ts };
      if (ev.parentId && Object.hasOwn(s.subagents, ev.parentId)) {
        const group = s.subagents[ev.parentId];
        return { ...base, subagents: { ...s.subagents, [ev.parentId]: { ...group, lines: cap([...group.lines, line], MAX_GROUP_LINES) } } };
      }
      const lines = cap([...s.lines, line], MAX_LINES);
      const kept = new Set(lines.map((l) => l.id));
      const dropped = lines.length < s.lines.length + 1;
      const order = [...s.order, line.id];
      return { ...base, lines, order: dropped ? order.filter((id) => Object.hasOwn(s.subagents, id) || kept.has(id)) : order };
    }
  }
}
