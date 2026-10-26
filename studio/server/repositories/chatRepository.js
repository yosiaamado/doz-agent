// Chats as JSONL logs in <workdir>/.doz-studio/chats/<chatId>.jsonl. A chat summary is rebuilt by folding its file.
import fs from 'node:fs';
import path from 'node:path';

export const CHAT_ID = /^c_[0-9a-f]{8}$/;
const MAX_ACTIVITY_PER_TURN = 500;
export const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LISTED = 100;

function newEntry(dir) {
  return { dir, chat: null, messages: [], activity: [], persistedActivity: 0 };
}

function fold(entry, ev) {
  const { chat } = entry;
  switch (ev.type) {
    case 'chat_created':
      entry.chat = { ...ev.chat };
      break;
    case 'chat_updated':
      Object.assign(chat, ev.patch, { updatedAt: ev.ts ?? chat.updatedAt });
      break;
    case 'chat_turn_start':
      chat.status = 'running';
      chat.turns = ev.turn;
      if (ev.title && !chat.title) chat.title = ev.title;
      chat.updatedAt = ev.ts ?? chat.updatedAt;
      entry.messages.push(ev.message);
      entry.activity = [];
      entry.persistedActivity = 0;
      break;
    case 'activity':
      if (entry.activity.length < MAX_ACTIVITY_PER_TURN) entry.activity.push(ev);
      break;
    case 'chat_turn_end':
      chat.status = ev.status === 'done' ? 'idle' : 'failed';
      chat.cost = (chat.cost ?? 0) + (ev.cost ?? 0);
      chat.updatedAt = ev.ts ?? chat.updatedAt;
      if (ev.message) entry.messages.push(ev.message);
      break;
    default:
  }
}

function parseLine(line) {
  if (!line.trim()) return null;
  try {
    const ev = JSON.parse(line);
    return ev && typeof ev === 'object' && ev.type ? ev : null;
  } catch {
    return null;
  }
}

export class ChatRegistry {
  // isActive(id): a turn is running for that chat. hasProfile(id): the profile still exists.
  constructor({ broadcast, isActive = () => false, hasProfile = () => true }) {
    this.broadcast = broadcast;
    this.isActive = isActive;
    this.hasProfile = hasProfile;
    this.entries = new Map();
    this.dir = null;
  }

  // dir = <workdir>/.doz-studio/chats. Chats whose last turn never ended (studio restarted) become failed here.
  // Chats with a running turn stay as they are: their process still reports into them.
  watch(dir) {
    const live = new Map([...this.entries].filter(([id]) => this.isActive(id)));
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.entries.clear();
    for (const f of fs.readdirSync(dir)) {
      const id = path.basename(f, '.jsonl');
      if (!f.endsWith('.jsonl') || !CHAT_ID.test(id)) continue;
      if (live.get(id)?.dir === dir) {
        this.entries.set(id, live.get(id));
        continue;
      }
      const entry = newEntry(dir);
      for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
        const ev = parseLine(line);
        if (ev && (entry.chat || ev.type === 'chat_created')) fold(entry, ev);
      }
      if (!entry.chat) continue;
      this.sanitize(entry);
      if (entry.chat.status === 'running') this.interrupt(id, entry);
      this.entries.set(id, entry);
    }
    for (const [id, entry] of live) if (!this.entries.has(id)) this.entries.set(id, entry);
  }

  // The file may come from a cloned repo, so nothing in it can grant more than a new chat would have.
  sanitize(entry) {
    const { chat } = entry;
    chat.allowEdits = false;
    chat.workdir = path.resolve(entry.dir, '..', '..');
    if (typeof chat.sessionId !== 'string' || !SESSION_ID.test(chat.sessionId)) chat.sessionId = null;
    if (typeof chat.profileId !== 'string' || !this.hasProfile(chat.profileId)) chat.profileId = null;
  }

  interrupt(id, entry) {
    const turn = entry.chat.turns;
    const ts = Date.now();
    const ev = {
      type: 'chat_turn_end', chat: id, turn, ts, status: 'failed', cost: 0, usage: null, sessionId: entry.chat.sessionId,
      message: { id: `${id}:${turn}:error`, turn, role: 'error', text: 'The studio restarted while this turn was running', ts, errorCode: 'CHAT_INTERRUPTED' },
    };
    fold(entry, ev);
    fs.appendFileSync(path.join(entry.dir, `${id}.jsonl`), `${JSON.stringify(ev)}\n`);
  }

  file(id) {
    return path.join(this.entries.get(id)?.dir ?? this.dir, `${id}.jsonl`);
  }

  // True when some chat of the watched workdir uses the profile.
  references(profileId) {
    return [...this.entries.values()].some((e) => e.chat?.profileId === profileId);
  }

  create(chat) {
    const entry = newEntry(this.dir);
    this.entries.set(chat.id, entry);
    this.append(chat.id, { type: 'chat_created', chat });
    return this.get(chat.id);
  }

  // Activity beyond the per-turn cap is broadcast but not written to disk.
  append(id, event, persist = true) {
    let entry = this.entries.get(id);
    if (!entry) throw new Error(`unknown chat ${id}`);
    const ev = { ts: Date.now(), ...event };
    fold(entry, ev);
    entry = this.entries.get(id);
    if (ev.type === 'activity') {
      if (entry.persistedActivity >= MAX_ACTIVITY_PER_TURN) persist = false;
      else entry.persistedActivity += 1;
    }
    if (persist && entry.dir) fs.appendFileSync(this.file(id), `${JSON.stringify(ev)}\n`);
    const out = ev.type === 'chat_updated' ? { type: 'chat_updated', chat: this.get(id) } : ev.type === 'chat_created' ? { ...ev, chat: this.get(id) } : ev;
    this.broadcast({ type: 'chat', event: out });
  }

  get(id) {
    const chat = typeof id === 'string' && CHAT_ID.test(id) ? this.entries.get(id)?.chat : null;
    return chat ? { ...chat } : null;
  }

  list() {
    return [...this.entries.values()].filter((e) => e.dir === this.dir).map((e) => ({ ...e.chat })).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_LISTED);
  }

  messages(id) {
    return this.get(id) ? [...this.entries.get(id).messages] : [];
  }

  lastTurnActivity(id) {
    return this.get(id) ? [...this.entries.get(id).activity] : [];
  }

  remove(id) {
    if (!this.get(id)) return false;
    this.entries.delete(id);
    fs.rmSync(this.file(id), { force: true });
    this.broadcast({ type: 'chat', event: { type: 'chat_deleted', chat: id } });
    return true;
  }
}
