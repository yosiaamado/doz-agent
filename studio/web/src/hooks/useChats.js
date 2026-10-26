import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { emptyActivity, reduceActivity } from '../lib/activity.js';
import { subscribe, subscribeStatus } from '../lib/events.js';
import { createLatest } from '../lib/latest.js';

// state: { chats: Chat[] (newest first), details: { [chatId]: { messages, stream } }, streams: { [chatId]: stream } }. A detail exists
// only for chats whose messages were fetched, so a chat we never opened is never shown with a partial history; streams are kept
// for every chat so the Office can show what a background chat is doing.
export const emptyChats = () => ({ chats: [], details: {}, streams: {} });

const byRecent = (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
const sorted = (list) => [...list].sort(byRecent);

function upsert(state, chat) {
  const exists = state.chats.some((c) => c.id === chat.id);
  const chats = exists ? state.chats.map((c) => (c.id === chat.id ? { ...c, ...chat } : c)) : [...state.chats, chat];
  return { ...state, chats: sorted(chats) };
}

function patchChat(state, id, patch) {
  if (!state.chats.some((c) => c.id === id)) return state;
  return { ...state, chats: sorted(state.chats.map((c) => (c.id === id ? { ...c, ...patch(c) } : c))) };
}

function patchDetail(state, id, fn) {
  const detail = state.details[id];
  return detail ? { ...state, details: { ...state.details, [id]: fn(detail) } } : state;
}

const withMessage = (detail, message) => (
  !message || detail.messages.some((m) => m.id === message.id) ? detail : { ...detail, messages: [...detail.messages, message] }
);

export function applyList(state, chats) {
  const ids = new Set(chats.map((c) => c.id));
  const details = Object.fromEntries(Object.entries(state.details).filter(([id]) => ids.has(id)));
  const streams = Object.fromEntries(Object.entries(state.streams ?? {}).filter(([id]) => ids.has(id)));
  return { chats: sorted(chats), details, streams };
}

// A POST response can arrive after newer socket events; it only fills in what the socket has not already delivered.
export function applyResponse(state, chat) {
  const known = state.chats.find((c) => c.id === chat.id);
  return known && (chat.updatedAt ?? 0) <= (known.updatedAt ?? 0) ? state : upsert(state, chat);
}

export function applyDetail(state, { chat, messages, activity }) {
  const stream = (activity ?? []).reduce(reduceActivity, emptyActivity());
  const next = upsert(state, chat);
  return { ...next, details: { ...next.details, [chat.id]: { messages, stream } }, streams: { ...next.streams, [chat.id]: stream } };
}

// One socket message `{ type: 'chat', event }` folded into the state. Anything else is ignored.
export function reduceChat(state, msg) {
  if (msg?.type !== 'chat' || !msg.event) return state;
  const ev = msg.event;
  switch (ev.type) {
    case 'chat_created': {
      const next = upsert(state, ev.chat);
      return Object.hasOwn(next.details, ev.chat.id) ? next : { ...next, details: { ...next.details, [ev.chat.id]: { messages: [], stream: emptyActivity() } } };
    }
    case 'chat_updated':
      return upsert(state, ev.chat);
    case 'chat_deleted': {
      const { [ev.chat]: _gone, ...details } = state.details;
      const { [ev.chat]: _stream, ...streams } = state.streams ?? {};
      return { chats: state.chats.filter((c) => c.id !== ev.chat), details, streams };
    }
    case 'chat_turn_start': {
      const started = patchChat(state, ev.chat, (c) => ({
        status: 'running', turns: Math.max(c.turns ?? 0, ev.turn ?? 0), updatedAt: ev.ts, ...(ev.title ? { title: ev.title } : {}),
      }));
      const next = started.chats.some((c) => c.id === ev.chat) ? { ...started, streams: { ...started.streams, [ev.chat]: emptyActivity() } } : started;
      return patchDetail(next, ev.chat, (d) => ({ ...withMessage(d, ev.message), stream: emptyActivity() }));
    }
    case 'activity': {
      if (!state.chats.some((c) => c.id === ev.chat)) return state;
      const next = { ...state, streams: { ...state.streams, [ev.chat]: reduceActivity(state.streams?.[ev.chat] ?? emptyActivity(), ev) } };
      return patchDetail(next, ev.chat, (d) => ({ ...d, stream: reduceActivity(d.stream, ev) }));
    }
    case 'chat_turn_end':
      return patchDetail(
        patchChat(state, ev.chat, (c) => ({
          status: ev.status === 'failed' ? 'failed' : 'idle',
          turns: Math.max(c.turns ?? 0, ev.turn ?? 0),
          endedTurn: Math.max(endedTurnOf(c), ev.turn ?? 0),
          cost: (c.cost ?? 0) + ((ev.turn ?? 0) > endedTurnOf(c) ? ev.cost ?? 0 : 0),
          sessionId: ev.sessionId ?? c.sessionId,
          updatedAt: ev.ts,
        })),
        ev.chat,
        (d) => withMessage(d, ev.message),
      );
    default:
      return state;
  }
}

// Highest turn whose cost is already in chat.cost; a chat loaded from the server has settled every turn but a running one.
const endedTurnOf = (c) => c.endedTurn ?? Math.max(0, (c.turns ?? 0) - (c.status === 'running' ? 1 : 0));

function reducer(state, action) {
  switch (action.type) {
    case 'socket': return reduceChat(state, action.msg);
    case 'response': return applyResponse(state, action.chat);
    case 'list': return applyList(state, action.chats);
    case 'detail': return applyDetail(state, action.data);
    case 'reset': return emptyChats();
    default: return state;
  }
}

const asChatEvent = (type, chat) => ({ type: 'socket', msg: { type: 'chat', event: { type, chat } } });

export function useChats({ workdir = null } = {}) {
  const [state, dispatch] = useReducer(reducer, undefined, emptyChats);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailState, setDetailState] = useState({ loading: false, error: null });
  const listLatest = useRef(createLatest());
  const detailLatest = useRef(createLatest());
  const selectedRef = useRef(null);
  selectedRef.current = selectedId;

  const refresh = useCallback(async () => {
    const isCurrent = listLatest.current.next();
    try {
      const chats = await api.chats();
      if (!isCurrent()) return;
      dispatch({ type: 'list', chats });
      setError(null);
    } catch (err) {
      if (isCurrent()) setError(err);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id) => {
    const isCurrent = detailLatest.current.next();
    if (!id) {
      setDetailState({ loading: false, error: null });
      return;
    }
    setDetailState({ loading: true, error: null });
    try {
      const data = await api.chat(id);
      if (!isCurrent()) return;
      dispatch({ type: 'detail', data });
      setDetailState({ loading: false, error: null });
    } catch (err) {
      if (isCurrent()) setDetailState({ loading: false, error: err });
    }
  }, []);

  const select = useCallback((id) => {
    setSelectedId(id);
    return loadDetail(id);
  }, [loadDetail]);

  useEffect(() => {
    dispatch({ type: 'reset' });
    setSelectedId(null);
    detailLatest.current.cancel();
    setDetailState({ loading: false, error: null });
    setLoading(true);
    refresh();
  }, [workdir, refresh]);

  useEffect(() => {
    const lists = listLatest.current;
    const details = detailLatest.current;
    let everOpen = false;
    let dropped = false;
    const offMessages = subscribe((msg) => dispatch({ type: 'socket', msg }));
    const offStatus = subscribeStatus((status) => {
      if (status === 'reconnecting') {
        dropped = everOpen;
        return;
      }
      if (dropped) {
        refresh();
        if (selectedRef.current) loadDetail(selectedRef.current);
      }
      everOpen = true;
      dropped = false;
    });
    return () => { offMessages(); offStatus(); lists.cancel(); details.cancel(); };
  }, [refresh, loadDetail]);

  const selectedChat = state.chats.find((c) => c.id === selectedId) ?? null;
  const detail = selectedChat ? state.details[selectedChat.id] : null;
  const selected = useMemo(() => (selectedChat ? {
    chat: selectedChat,
    messages: detail?.messages ?? [],
    stream: detail?.stream ?? emptyActivity(),
    loading: detailState.loading || !detail,
    error: detailState.error,
  } : null), [selectedChat, detail, detailState]);

  const create = useCallback(async (agent) => {
    const chat = await api.createChat(agent, false);
    dispatch(asChatEvent('chat_created', chat));
    await select(chat.id);
    return chat;
  }, [select]);

  const send = useCallback(async (text) => {
    const { chat } = await api.sendChat(selectedRef.current, text);
    dispatch({ type: 'response', chat });
  }, []);

  const retry = useCallback(async () => {
    const { chat } = await api.retryChat(selectedRef.current);
    dispatch({ type: 'response', chat });
  }, []);

  const setAllowEdits = useCallback(async (allowEdits) => {
    const chat = await api.updateChat(selectedRef.current, { allowEdits });
    dispatch(asChatEvent('chat_updated', chat));
  }, []);

  const remove = useCallback(async (id) => {
    const result = await api.deleteChat(id);
    dispatch({ type: 'socket', msg: { type: 'chat', event: { type: 'chat_deleted', chat: id } } });
    if (selectedRef.current === id) select(null);
    return result;
  }, [select]);

  return {
    chats: state.chats, streams: state.streams, selected, selectedId: selectedChat?.id ?? null, loading, error,
    refresh, retryDetail: () => loadDetail(selectedRef.current), select, create, send, retry, setAllowEdits, remove,
  };
}
