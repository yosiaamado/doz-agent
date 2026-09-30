// The run registry plus JSONL logs in <workdir>/.doz-studio/runs/<id>.jsonl.
// Runs from the run-workflow skill (Claude Code in a terminal) write the same event format into this folder,
// so the studio can show them in real time by polling the files.
import fs from 'node:fs';
import path from 'node:path';

const MAX_EVENTS_IN_MEMORY = 5000;

export class RunRegistry {
  constructor({ broadcast }) {
    this.broadcast = broadcast;
    this.runs = new Map(); // id → { id, workflow, source, status, cost, events, started, run? }
    this.offsets = new Map();
    this.dir = null;
  }

  // dir = <workdir>/.doz-studio/runs
  watch(dir) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
    this.offsets.clear();
    // Start at the end of the existing file; its history is read on demand.
    for (const f of this.files()) this.offsets.set(f, fs.statSync(path.join(this.dir, f)).size);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.poll(), 700);
    this.timer.unref?.();
  }

  files() {
    try {
      return fs.readdirSync(this.dir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      return [];
    }
  }

  poll() {
    for (const f of this.files()) {
      const id = path.basename(f, '.jsonl');
      if (this.runs.get(id)?.run) continue; // one of the studio's own runs, already in memory
      const full = path.join(this.dir, f);
      const size = fs.statSync(full).size;
      const from = this.offsets.get(f) ?? 0;
      if (size <= from) continue;
      const fd = fs.openSync(full, 'r');
      const buf = Buffer.alloc(size - from);
      fs.readSync(fd, buf, 0, buf.length, from);
      fs.closeSync(fd);
      const text = buf.toString('utf8');
      const lastNl = text.lastIndexOf('\n');
      if (lastNl < 0) continue; // wait for a complete line
      this.offsets.set(f, from + Buffer.byteLength(text.slice(0, lastNl + 1)));
      for (const line of text.slice(0, lastNl).split('\n')) {
        const ev = parseLine(line);
        if (ev) this.record({ source: 'claude-code', ...ev, run: ev.run ?? id }, false);
      }
    }
  }

  create(id, workflow, run) {
    const entry = { id, workflow, source: 'studio', status: 'running', cost: 0, events: [], started: Date.now(), run };
    this.runs.set(id, entry);
    return entry;
  }

  record(event, persist = true) {
    const ev = { ts: Date.now(), ...event };
    let entry = this.runs.get(ev.run);
    if (!entry) {
      entry = { id: ev.run, workflow: ev.workflow ?? '?', source: ev.source ?? 'claude-code', status: 'running', cost: 0, events: [], started: ev.ts };
      this.runs.set(ev.run, entry);
    }
    if (ev.type === 'run_start' && ev.workflow) entry.workflow = ev.workflow;
    if (ev.type === 'run_end') entry.status = ev.status ?? 'done';
    if (ev.type === 'cost') entry.cost = ev.total;
    if (ev.type === 'run_end' && ev.cost !== undefined) entry.cost = ev.cost;
    entry.events.push(ev);
    if (entry.events.length > MAX_EVENTS_IN_MEMORY) entry.events.splice(0, entry.events.length - MAX_EVENTS_IN_MEMORY);
    if (persist && this.dir) {
      fs.appendFileSync(path.join(this.dir, `${ev.run}.jsonl`), `${JSON.stringify(ev)}\n`);
    }
    this.broadcast({ type: 'event', event: { source: entry.source, ...ev } });
  }

  list() {
    const out = new Map();
    for (const f of this.files()) {
      const id = path.basename(f, '.jsonl');
      if (this.runs.has(id)) continue;
      const summary = summarizeFile(path.join(this.dir, f), id);
      if (summary) out.set(id, summary);
    }
    for (const r of this.runs.values()) {
      const end = r.events.findLast((e) => e.type === 'run_end');
      out.set(r.id, { id: r.id, workflow: r.workflow, source: r.source, status: r.status, cost: r.cost, started: r.started, duration: end ? end.ts - r.started : null });
    }
    return [...out.values()].sort((a, b) => b.started - a.started).slice(0, 50);
  }

  events(id) {
    const r = this.runs.get(id);
    if (r?.run) return r.events;
    // A run started outside the studio: the file is its complete source (memory only holds the lines since the studio started).
    const file = path.join(this.dir, `${id}.jsonl`);
    if (!/^[\w.-]+$/.test(id) || !fs.existsSync(file)) return r?.events ?? null;
    return fs.readFileSync(file, 'utf8').split('\n').map(parseLine).filter(Boolean)
      .map((ev) => ({ source: 'claude-code', ...ev, run: ev.run ?? id }));
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

function summarizeFile(file, id) {
  const events = fs.readFileSync(file, 'utf8').split('\n').map(parseLine).filter(Boolean);
  if (!events.length) return null;
  const start = events.find((e) => e.type === 'run_start') ?? events[0];
  const end = events.findLast((e) => e.type === 'run_end');
  const cost = end?.cost ?? events.findLast((e) => e.type === 'cost')?.total ?? 0;
  return {
    id,
    workflow: start.workflow ?? '?',
    source: start.source ?? 'claude-code',
    status: end?.status ?? 'running',
    cost,
    started: start.ts ?? fs.statSync(file).mtimeMs,
    duration: end?.ts && start.ts ? end.ts - start.ts : null,
  };
}
