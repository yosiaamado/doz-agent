// Claude Code usage: the 5-hour / 7-day limits (from the rate_limit_event that `claude -p` emits) and
// the local token totals (from the transcripts in ~/.claude/projects/**/*.jsonl).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const HOUR = 3_600_000;
const WINDOWS = Object.freeze({ five_hour: 5 * HOUR, seven_day: 7 * 24 * HOUR });
const CACHE_MS = 60_000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function transcriptFiles(root, since) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = path.join(root, d.name);
      return fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
    })
    .filter((f) => fs.statSync(f).mtimeMs >= since);
}

function tokensOf(u) {
  return (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
}

// A single message can be recorded several times (once per content block), so it is counted per message id.
async function scanTranscript(file, since, seen) {
  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.includes('"usage"')) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const msg = ev.message;
    const ts = Date.parse(ev.timestamp ?? '');
    if (ev.type !== 'assistant' || !msg?.usage || !msg.id || !(ts >= since) || seen.has(msg.id)) continue;
    seen.add(msg.id);
    rows.push({ ts, model: msg.model ?? 'unknown', tokens: tokensOf(msg.usage), output: msg.usage.output_tokens ?? 0 });
  }
  return rows;
}

export function summarizeRows(rows, now = Date.now()) {
  return Object.fromEntries(Object.entries(WINDOWS).map(([key, span]) => {
    const inWindow = rows.filter((r) => r.ts >= now - span);
    const byModel = inWindow.reduce((acc, r) => ({ ...acc, [r.model]: (acc[r.model] ?? 0) + r.tokens }), {});
    return [key, { tokens: inWindow.reduce((a, r) => a + r.tokens, 0), messages: inWindow.length, byModel }];
  }));
}

export function createUsageService({ usageFile, projectsDir = path.join(os.homedir(), '.claude', 'projects'), probe } = {}) {
  let cache = { at: 0, local: null };

  const localUsage = async () => {
    if (cache.local && Date.now() - cache.at < CACHE_MS) return cache.local;
    const since = Date.now() - WINDOWS.seven_day;
    const seen = new Set();
    const rows = (await Promise.all(transcriptFiles(projectsDir, since).map((f) => scanTranscript(f, since, seen)))).flat();
    const local = summarizeRows(rows);
    cache = { at: Date.now(), local };
    return local;
  };

  return {
    // Called by the runner every time Claude Code sends rate limit information.
    recordRateLimit(info) {
      fs.writeFileSync(usageFile, JSON.stringify({ updatedAt: Date.now(), info }, null, 2));
    },
    async summary() {
      const saved = readJson(usageFile);
      return { limits: saved?.info ?? null, limitsUpdatedAt: saved?.updatedAt ?? null, local: await localUsage(), projectsDir };
    },
    // A small call to Claude Code (haiku, 1 turn) purely to obtain the latest rate_limit_event.
    async refresh() {
      if (!probe) throw new Error('refresh is not available');
      await probe();
      cache = { at: 0, local: null };
      return this.summary();
    },
  };
}
