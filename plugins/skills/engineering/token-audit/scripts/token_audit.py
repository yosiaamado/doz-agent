#!/usr/bin/env python3
"""Token & failure audit for a single Claude Code workflow (e.g. /ship-feature).

Reads a Claude Code JSONL transcript, counts tokens per agent from the API
`usage` figures (exact), looks for wasteful patterns (tool-result size is
estimated as characters / 4), reads failures from the agent report format
(Status, Decision, CR-n/QA-BUG-n/SEC-n findings, failing tests/builds), then
suggests fixes per agent. Findings are logged to findings.csv to detect failure
patterns that recur across workflows.

Usage:
  token_audit.py                      # the last workflow (default: ship-feature) in the newest session
  token_audit.py --workflow NAME      # the last workflow started by skill NAME
  token_audit.py --all                # the whole session
  token_audit.py --since 2026-09-23T10:00:00Z
  token_audit.py --transcript PATH    # a specific transcript
  token_audit.py --no-log             # don't write to the trend log
  token_audit.py --compare            # compare engineer models across every recorded workflow
"""
import argparse
import csv
import glob
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

# API list prices per 1 million tokens: (input, output, cache read).
# Cache write = 1.25x input (5-minute TTL) or 2x input (1-hour TTL).
# Update when prices change. Pro/Max subscriptions are not billed per token,
# so the $ figures in the report only serve to compare agents.
PRICES = {
    "claude-fable-5-1": (10.0, 50.0, 0.25),
    "claude-fable-5": (10.0, 50.0, 1.0),
    "claude-opus-5-5": (4.0, 20.0, 0.20),
    "claude-opus-5": (5.0, 25.0, 0.50),
    "claude-opus-4-8": (5.0, 25.0, 0.50),
    "claude-opus-4-7": (5.0, 25.0, 0.50),
    "claude-opus-4-6": (5.0, 25.0, 0.50),
    "claude-sonnet-5": (2.0, 10.0, 0.20),
    "claude-sonnet-4-6": (3.0, 15.0, 0.30),
    "claude-haiku-4-5": (1.0, 5.0, 0.10),
}

SEARCH_TOOLS = {"Grep", "Glob"}
SEARCH_CMD = re.compile(r"^\s*(cd [^&;]+(&&|;)\s*)?(grep|rg|find|ls|tree|git (grep|ls-files|log))\b")
EDIT_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
AGENT_TOOLS = {"Agent", "Task"}
READ_ONLY_AGENTS = {"code-reviewer", "qa-tester", "security-tester", "system-analyst", "product-owner"}

# Thresholds for wasteful patterns
BIG_READ = 3000        # tokens, one Read without offset/limit
BIG_BASH = 1500        # tokens, one Bash output
BIG_SKILL = 3000       # tokens, one loaded skill
LONG_REPORT = 700      # tokens, a subagent final report (~500 words)
NARRATION = 400        # tokens, total text between tool calls
SEARCH_BEFORE_EDIT = 12
SEARCH_READ_ONLY = 20
CACHE_MISS = 30000     # cache-write tokens on a later turn
MAIN_CONTEXT = 150000  # main-thread context tokens at the end of the workflow


def tok(x):
    if x is None:
        return 0
    s = x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)
    return len(s) // 4


def price_for(model):
    if not model:
        return None
    m = re.sub(r"\[.*?\]$", "", model)
    m = re.sub(r"-\d{8}$", "", m)
    m = m.split(".")[-1] if m.startswith(("us.", "eu.", "anthropic.")) else m
    for key in sorted(PRICES, key=len, reverse=True):
        if m.startswith(key):
            return PRICES[key]
    return None


def short_model(model):
    return re.sub(r"^claude-", "", re.sub(r"-\d{8}$", "", model or "?"))


def parse_ts(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def load_jsonl(path):
    out = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def config_dir():
    return os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")


def find_transcript():
    projects = os.path.join(config_dir(), "projects")
    slug = re.sub(r"[^A-Za-z0-9]", "-", os.getcwd())
    cands = glob.glob(os.path.join(projects, slug, "*.jsonl"))
    if not cands:
        cands = glob.glob(os.path.join(projects, "*", "*.jsonl"))
    if not cands:
        sys.exit(f"No transcript found in {projects}. Use --transcript PATH.")
    return max(cands, key=os.path.getmtime)


class Stream:
    """One thread (main, or a single subagent call) along with its statistics."""

    def __init__(self, name, entries):
        self.name = name
        self.model = None
        self.usage = {}        # message.id -> usage (the last one wins)
        self.order = []        # order of message.id
        self.ts = {}           # message.id -> timestamp
        self.events = []       # (turn_idx, kind, data)
        self.final_text = ""
        self.user_msgs = []    # (next turn_idx, text) for ordinary user messages, not tool_result
        self._build(entries)
        self.runs = [(0, len(self.order))]  # (start turn, end turn) per run; >1 when the agent is continued
        self.resumes = []      # the SendMessage prompts that continued this agent

    def _build(self, entries):
        tool_uses = {}
        for e in entries:
            t = e.get("type")
            msg = e.get("message") or {}
            if t == "assistant":
                mid = msg.get("id") or e.get("uuid")
                if mid not in self.usage:
                    self.order.append(mid)
                    self.ts[mid] = parse_ts(e.get("timestamp", ""))
                if msg.get("usage"):
                    self.usage[mid] = msg["usage"]
                self.model = msg.get("model") or self.model
                turn = len(self.order) - 1
                has_tool = False
                texts = []
                for b in msg.get("content") or []:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "tool_use":
                        has_tool = True
                        tool_uses[b.get("id")] = (b.get("name"), b.get("input") or {})
                        self.events.append((turn, "tool_use", (b.get("name"), b.get("input") or {})))
                    elif b.get("type") == "text":
                        texts.append(b.get("text", ""))
                if texts:
                    self.events.append((turn, "text", ("\n".join(texts), has_tool)))
                    self.final_text = "\n".join(texts)
            elif t == "user":
                content = msg.get("content")
                turn = len(self.order) - 1
                has_result = False
                if isinstance(content, list):
                    for b in content:
                        if isinstance(b, dict) and b.get("type") == "tool_result":
                            has_result = True
                            name, inp = tool_uses.get(b.get("tool_use_id"), ("?", {}))
                            body = text_of(b.get("content"))
                            err = bool(b.get("is_error")) or bool(re.match(r"\s*(Error: )?Exit code [1-9]", body))
                            snippet = body if len(body) <= 6000 else body[:3000] + "\n" + body[-3000:]
                            self.events.append((turn, "tool_result", (name, inp, tok(b.get("content")), e, err, snippet if err else "")))
                txt = text_of(content)
                if txt.strip() and not has_result:
                    self.user_msgs.append((len(self.order), txt))
                if txt.startswith("Base directory for this skill"):
                    m = re.search(r"skills?/(?:[^/\s]+/)*([^/\s]+)\s", txt)
                    self.events.append((turn, "skill", (m.group(1) if m else "skill", tok(txt))))

    @property
    def turns(self):
        return len(self.order)

    def totals(self, start=0, end=None):
        t = Counter()
        for mid in dict.fromkeys(self.order[start:end]):
            u = self.usage.get(mid)
            if not u:
                continue
            t["input"] += u.get("input_tokens", 0) or 0
            t["output"] += u.get("output_tokens", 0) or 0
            t["cache_read"] += u.get("cache_read_input_tokens", 0) or 0
            cc = u.get("cache_creation") or {}
            w1h = cc.get("ephemeral_1h_input_tokens")
            w5m = cc.get("ephemeral_5m_input_tokens")
            total_w = u.get("cache_creation_input_tokens", 0) or 0
            if w1h is None and w5m is None:
                w5m, w1h = total_w, 0
            t["cache_write_5m"] += w5m or 0
            t["cache_write_1h"] += w1h or 0
            t["cache_write"] += total_w
        return t

    def split_runs(self, prompts):
        """Split the stream per run: the first run + one run per SendMessage that continued this agent."""
        self.resumes = list(prompts)
        starts, pos = [0], 0
        for p in prompts:
            head = (p or "").strip()[:60]
            hit = next(((i, turn) for i, (turn, txt) in enumerate(self.user_msgs)
                        if i >= pos and turn > starts[-1] and head and head in txt), None)
            if not hit:
                return  # the continuation message was not found in the transcript: still counted as one run
            pos = hit[0] + 1
            starts.append(hit[1])
        self.runs = list(zip(starts, starts[1:] + [len(self.order)]))

    def text_in(self, start, end):
        """The last assistant text within the turn range [start, end), i.e. one run's final report."""
        return next((d[0] for turn, kind, d in reversed(self.events) if kind == "text" and start <= turn < end), "")

    def cost(self, start=0, end=None):
        p = price_for(self.model)
        if not p:
            return None
        pin, pout, pread = p
        t = self.totals(start, end)
        return (t["input"] * pin + t["output"] * pout + t["cache_read"] * pread
                + t["cache_write_5m"] * pin * 1.25 + t["cache_write_1h"] * pin * 2.0) / 1e6

    def turn_usd(self, idx):
        p = price_for(self.model) or PRICES["claude-sonnet-5"]
        pin, pout, pread = p
        u = self.usage.get(self.order[idx], {}) if 0 <= idx < len(self.order) else {}
        return ((u.get("input_tokens", 0) or 0) * pin + (u.get("output_tokens", 0) or 0) * pout
                + (u.get("cache_read_input_tokens", 0) or 0) * pread
                + (u.get("cache_creation_input_tokens", 0) or 0) * pin * 1.5) / 1e6

    def carry_usd(self, size, turn):
        """Estimated cost of one context block: written to cache once, then read on every later turn."""
        p = price_for(self.model) or PRICES["claude-sonnet-5"]
        pin, _, pread = p
        remaining = max(self.turns - 1 - turn, 0)
        return size * (pin * 2.0 + pread * remaining) / 1e6, remaining

    def last_context(self):
        if not self.order:
            return 0
        u = self.usage.get(self.order[-1], {})
        return (u.get("input_tokens", 0) or 0) + (u.get("cache_read_input_tokens", 0) or 0) + (u.get("cache_creation_input_tokens", 0) or 0)


def slice_workflow(entries, workflow, since, use_all):
    main = [e for e in entries if not e.get("isSidechain")]
    if use_all:
        return main, "the whole session"
    if since:
        s = parse_ts(since)
        return [e for e in main if (parse_ts(e.get("timestamp", "")) or s) >= s], f"since {since}"
    start = None
    for i, e in enumerate(main):
        msg = e.get("message") or {}
        if e.get("type") == "assistant":
            for b in msg.get("content") or []:
                if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == "Skill":
                    if str((b.get("input") or {}).get("skill", "")).endswith(workflow):
                        start = i
        elif e.get("type") == "user":
            txt = text_of(msg.get("content"))
            if "<command-name>" in txt and workflow in txt:
                start = i
    if start is None:
        return main, f"the whole session (workflow `{workflow}` not found)"
    return main[start:], f"workflow `{workflow}`"


def find_subagent_entries(transcript, all_entries, call):
    """Find the subagent transcript: a subagents/ file, then an inline sidechain."""
    agent_id = call.get("agent_id")
    prompt = (call.get("prompt") or "").strip()
    base = os.path.splitext(transcript)[0]
    files = glob.glob(os.path.join(base, "subagents", "*.jsonl")) + glob.glob(os.path.join(base, "**", "agent-*.jsonl"), recursive=True)
    for f in dict.fromkeys(files):
        if agent_id and agent_id in os.path.basename(f):
            return load_jsonl(f)
    for f in dict.fromkeys(files):
        ents = load_jsonl(f)
        if agent_id and any(e.get("agentId") == agent_id for e in ents[:5]):
            return ents
        first_user = next((text_of((e.get("message") or {}).get("content")) for e in ents if e.get("type") == "user"), "")
        if prompt and first_user.strip()[:300] == prompt[:300]:
            return ents
    side = [e for e in all_entries if e.get("isSidechain") and (not agent_id or e.get("agentId") == agent_id)]
    if side and agent_id:
        return side
    return None


NOTIFICATION = re.compile(r"<task-notification>(.*?)</task-notification>", re.S)
TURN_LIMIT = re.compile(r"\d+[- ]turn limit|\bturn limit\b|\bmax_?turns\b", re.I)


def notifications_in(obj):
    """The contents of every <task-notification> in one transcript entry (user message or attachment)."""
    if isinstance(obj, str):
        return NOTIFICATION.findall(obj) if "<task-notification>" in obj else []
    if isinstance(obj, dict):
        return [n for v in obj.values() for n in notifications_in(v)]
    if isinstance(obj, list):
        return [n for v in obj for n in notifications_in(v)]
    return []


def collect_calls(main_entries):
    """Agent calls plus runs continued via SendMessage, in chronological order.

    A background agent only returns "Async agent launched" in its tool_result. Its report
    arrives later via <task-notification>, as does a continued run's report.
    """
    calls, by_id, by_agent, by_name, seen = [], {}, {}, {}, set()
    for e in main_entries:
        msg = e.get("message") or {}
        if e.get("type") == "assistant":
            for b in msg.get("content") or []:
                if not (isinstance(b, dict) and b.get("type") == "tool_use"):
                    continue
                inp = b.get("input") or {}
                if b.get("name") in AGENT_TOOLS:
                    c = {"id": b.get("id"), "type": str(inp.get("subagent_type") or "general-purpose").split(":")[-1],
                         "prompt": inp.get("prompt", ""), "agent_id": None, "result": None, "report": None,
                         "limit_hit": False}
                    calls.append(c)
                    by_id[c["id"]] = c
                    if inp.get("name"):
                        by_name[inp["name"]] = c
                elif b.get("name") == "SendMessage":
                    to = re.sub(r"\s*\[[^\]]*\]$", "", str(inp.get("to", ""))).strip()
                    root = by_name.get(to) or by_agent.get(to)
                    if root:
                        calls.append({"id": b.get("id"), "type": root["type"], "prompt": inp.get("message", ""),
                                      "agent_id": root["agent_id"], "result": None, "report": None, "resume_of": root,
                                      "limit_hit": False})
            continue
        if e.get("type") == "user" and isinstance(msg.get("content"), list):
            for b in msg["content"]:
                if isinstance(b, dict) and b.get("type") == "tool_result" and b.get("tool_use_id") in by_id:
                    c = by_id[b["tool_use_id"]]
                    r = e.get("toolUseResult")
                    if isinstance(r, dict):
                        c["agent_id"] = r.get("agentId") or c["agent_id"]
                        c["result"] = r
                        c["limit_hit"] = bool(TURN_LIMIT.search(str({k: v for k, v in r.items() if k not in ("content", "prompt")})))
                    if c["agent_id"]:
                        by_agent[c["agent_id"]] = c
                    if not (isinstance(r, dict) and r.get("status") == "async_launched"):
                        c["report"] = text_of(b.get("content"))
        for note in notifications_in(e):
            tid = re.search(r"<task-id>\s*([^<\s]+)\s*</task-id>", note)
            if not tid or note in seen:
                continue
            seen.add(note)
            res = re.search(r"<result>(.*?)</result>", note, re.S)
            c = next((c for c in calls if c["agent_id"] == tid.group(1) and c["report"] is None), None)
            if c:
                c["report"] = res.group(1).strip() if res else ""
                # A "stopped at its N-turn limit" notification: this run hit maxTurns, it is not a final report.
                c["limit_hit"] = bool(TURN_LIMIT.search(note.replace(res.group(0), "") if res else note))
    return calls


def max_turns_of(agent_type):
    here = os.path.dirname(os.path.abspath(__file__))
    for up in range(1, 7):
        cand = os.path.join(here, *([".."] * up), "agents", f"{agent_type}.md")
        if os.path.exists(cand):
            with open(cand, encoding="utf-8") as fh:
                m = re.search(r"^maxTurns:\s*(\d+)", fh.read(), re.M)
            return int(m.group(1)) if m else None
    return None


def analyse(stream, agent_type, is_main):
    gaps = []

    def add(rule, usd, detail, saran):
        gaps.append({"agent": agent_type, "rule": rule, "usd": usd, "detail": detail, "saran": saran})

    reads = Counter()
    reread_usd = defaultdict(float)
    search_turns_before_edit = set()
    search_turns = set()
    searches_before_edit = 0
    searches_total = 0
    edited = False
    narration = 0
    for turn, kind, data in stream.events:
        if kind == "tool_use":
            name, inp = data
            is_search = name in SEARCH_TOOLS or (name == "Bash" and SEARCH_CMD.match(str(inp.get("command", ""))))
            if is_search:
                searches_total += 1
                search_turns.add(turn)
                if not edited:
                    searches_before_edit += 1
                    search_turns_before_edit.add(turn)
            if name in EDIT_TOOLS:
                edited = True
        elif kind == "text":
            text, has_tool = data
            if has_tool:
                narration += tok(text)
        elif kind == "tool_result":
            name, inp, size = data[:3]
            if name == "Read":
                path = inp.get("file_path", "?")
                full = not inp.get("offset") and not inp.get("limit")
                if full:
                    reads[path] += 1
                    if reads[path] >= 2:
                        reread_usd[path] += stream.carry_usd(size, turn)[0]
                if full and size >= BIG_READ:
                    usd, rem = stream.carry_usd(size, turn)
                    add("Whole large file read", usd, f"`{os.path.basename(path)}` ~{size/1000:.1f}k tok, carried {rem} turns",
                        "Grep for the symbol first, then Read with offset/limit. If this file is always needed, put its path + the important part in the file map/memory.")
            elif name == "Bash" and size >= BIG_BASH:
                usd, rem = stream.carry_usd(size, turn)
                cmd = re.sub(r"\s+", " ", str(inp.get("command", "")))[:60]
                add("Large command output", usd, f"`{cmd}` ~{size/1000:.1f}k tok, carried {rem} turns",
                    "Filter the output: quiet mode, `| tail -n 40`, `--stat`, or filter tests by file/name.")
            elif name in AGENT_TOOLS and is_main and size >= LONG_REPORT:
                usd, rem = stream.carry_usd(size, turn)
                add("Long subagent report", usd, f"a ~{size} tok report entered the main thread, carried {rem} turns",
                    "The agent did not follow the report limit/format. Tighten the Report section in its agent file.")
        elif kind == "skill":
            name, size = data
            if size >= BIG_SKILL:
                usd, rem = stream.carry_usd(size, turn)
                add("Large skill loaded", usd, f"`{name}` ~{size/1000:.1f}k tok, carried {rem} turns",
                    "Split the skill: keep the core in SKILL.md, move the detail into references/ read only when needed.")

    for path, n in reads.items():
        if n >= 2:
            add("File re-read", reread_usd[path], f"`{os.path.basename(path)}` read in full {n}x",
                "The file contents are already in context. If re-reading after an edit, read only the changed part.")

    limit = SEARCH_READ_ONLY if agent_type in READ_ONLY_AGENTS or is_main else SEARCH_BEFORE_EDIT
    count = searches_total if agent_type in READ_ONLY_AGENTS or is_main else searches_before_edit
    if count >= limit:
        read_only = agent_type in READ_ONLY_AGENTS or is_main
        where = "total" if read_only else "before the first edit"
        turns_used = search_turns if read_only else search_turns_before_edit
        add("Long exploration", sum(stream.turn_usd(t) for t in turns_used), f"{count} searches {where}",
            "The spec's file map is incomplete, or memory does not cover this area yet. Complete the file map (paths + reference patterns).")

    if narration >= NARRATION:
        p = price_for(stream.model) or PRICES["claude-sonnet-5"]
        add("Narration between tool calls", narration * p[1] / 1e6, f"~{narration} tok of output text between tool calls",
            "The `Output style` rule is not being followed. Make sure that section is present in its agent file.")

    prev_ts = None
    misses = []
    for i, mid in enumerate(stream.order):
        u = stream.usage.get(mid, {})
        w = u.get("cache_creation_input_tokens", 0) or 0
        ts = stream.ts.get(mid)
        if i > 0 and w >= CACHE_MISS and (u.get("cache_read_input_tokens", 0) or 0) < w:
            gap = int((ts - prev_ts).total_seconds() // 60) if ts and prev_ts else None
            misses.append((i + 1, w, gap))
        prev_ts = ts or prev_ts
    if misses:
        p = price_for(stream.model) or PRICES["claude-sonnet-5"]
        w_total = sum(w for _, w, _ in misses)
        long_gaps = sum(1 for _, _, g in misses if g is not None and g >= 5)
        where = ", ".join(f"turn {t}" + (f" ({g} min gap)" if g is not None and g >= 5 else "") for t, _, g in misses[:4])
        add("Cache miss", w_total * p[0] * 1.5 / 1e6, f"{len(misses)}x, ~{w_total/1000:.0f}k tok rewritten: {where}",
            "The cache expired because the gap was longer than the TTL" if long_gaps == len(misses) else
            "Some had no long gap: the initial prompt changed (e.g. compaction, or CLAUDE.md/memory edited mid-run), or a gap exceeded the TTL. Avoid long pauses in the middle of a workflow.")

    if not is_main:
        mt = max_turns_of(agent_type)
        # maxTurns applies per run. If continued runs cannot be split apart, do not guess.
        turns = max(b - a for a, b in stream.runs)
        if mt and len(stream.runs) == 1 + len(stream.resumes) and turns >= 0.8 * mt:
            add("Nearly out of turns", 0.0, f"{turns}/{mt} turns",
                "The scope is too broad for one call. Split the work up or make the brief clearer.")
        w1h = stream.totals()["cache_write_1h"]
        times = [stream.ts[m] for m in stream.order if stream.ts.get(m)]
        longest = max(((b - a).total_seconds() / 60 for a, b in zip(times, times[1:])), default=0)
        if w1h and longest < 5:
            p = price_for(stream.model) or PRICES["claude-sonnet-5"]
            add("1-hour cache TTL unused", w1h * p[0] * (2.0 - 1.25) / 1e6,
                f"~{w1h/1000:.0f}k tok written with a 1-hour TTL, longest gap between requests {longest:.1f} min",
                "With no gap of ≥5 minutes, the 5-minute cache never expires, so a 1-hour TTL only raises the write "
                "cost from 1.25x to 2x the input price. Remove `experimental.cacheTtl` from this agent file.")
    elif stream.last_context() >= MAIN_CONTEXT:
        add("Large main-thread context", 0.0, f"~{stream.last_context()/1000:.0f}k tok at the end of the workflow",
            "Start a new session per feature; don't forward whole agent reports to other agents.")
    return gaps


def fmt_k(n):
    return f"{n/1e6:.2f}M" if n >= 1e6 else f"{n/1e3:.1f}k" if n >= 1e3 else str(n)


def fmt_usd(x):
    return "–" if x is None else f"${x:.2f}"


# ---------------------------------------------------------------------------
# Failures & findings: read from the agent report format (Status/Decision/finding IDs)

ENGINEERS = {"backend-engineer", "frontend-engineer", "devops-engineer"}
VERIFIERS = {"code-reviewer", "qa-tester", "security-tester"}
FE_EXT = (".tsx", ".jsx", ".vue", ".svelte", ".css", ".scss", ".sass", ".less", ".html")
DEVOPS_PATH = re.compile(r"(Dockerfile|\.ya?ml$|\.github/|\.tf$|compose|helm/|k8s/)", re.I)
BUILD_CMD = re.compile(r"\b(test|tests|build|lint|tsc|pytest|jest|vitest|playwright|dotnet|mvn|gradle|cargo|go (test|build|vet)|npm|pnpm|yarn|make|eslint|ruff|mypy)\b")
FINDING = re.compile(r"^\s*[-*]?\s*`?(?P<id>(?:CR|QA-BUG|SEC)-\d+)`?\s+`?(?P<path>[^\s`]+?)`?:?\s+(?P<rest>.+)$")
STATUS = re.compile(r"^\W*Status:\s*\**\s*(done|partial|blocked|needs-decision|too-big)", re.I | re.M)
VERDICT = re.compile(r"^\W*(Decision|Recommendation|Keputusan|Rekomendasi):\s*(.+)$", re.I | re.M)
NEXT_SLICE = re.compile(r"\bslice\b", re.I)
FIX_MODE = re.compile(r"\b(fix mode|mode perbaikan)\b", re.I)
MAXTURNS = "maxturns"  # pseudo-status: the run stopped at maxTurns with no report

# (category, keywords, suggestion). Order matters: the first match wins.
# Keywords are matched at a word boundary ("lock" won't match "blocking", "race" won't match "trace").
# A tuple = every group must match (at least one word per group).
# A suggestion is always a general process rule for the agent, never a fix for one project's error.
CATEGORIES = [
    ("aggregate-authz", [(["permission", "authoriz", "otorisasi", "izin", "role", "akses"],
                        ["tree", "agregat", "aggregat", "dashboard", "search", "pencarian", "export", "proxy", "leak", "bocor"])],
     "Endpoints that display or aggregate other resources (tree, dashboard, search, export, proxy) must enforce read permission on the underlying resource, with a test for a role lacking permission on it."),
    ("state-update", ["setstate", "usestate", "usereducer", "state map", "stale state", "stale closure",
                      (["spread", "merge", "menimpa", "timpa", "overwrite"], ["state", "prev"])],
     "Frontend self-review: state shaped as a map/list is updated by merging the previous value (`{...prev, [key]: v}`), checked with 2 keys active at once."),
    ("css-cascade", ["inline style", "specificity", "spesifisitas", "hover", "cascade", "!important"],
     "Frontend self-review: a new style/variant mechanism is checked against the base value + hover/focus/disabled + the built-in variants; inline styles beat classes."),
    ("loop/corrupt-data", ["infinite", "loop", "rekursi", "recursion", "siklus", "cycle", "korup", "corrupt", "orphan"],
     "Make it mandatory in self-review: every loop/recursion over stored data has a limit or a visited set, plus one test with corrupt data (cycle/orphan)."),
    ("existing-tests", ["test lama", "existing test", "test yang ada", "test yang sudah ada", "pasti gagal", "failing test", "snapshot", "regresi", "regression"],
     "Before editing, grep for tests using the symbol about to change; after editing, the full suite must be green before reporting."),
    ("null/no-op", ["null", "no-op", "noop", "diam-diam", "silent", "tidak berfungsi", "tidak berefek", "undefined", "dikosongkan", "reset"],
     "For every editable field, a 'clearing' variant test (null / remove / reset) is required before the implementation counts as done."),
    ("authorization/IDOR", ["idor", "authoriz", "otorisasi", "milik user lain", "role", "permission", "401", "403"],
     "Every new endpoint needs a test for accessing another user's resource (IDOR) and for the wrong role, not just 401."),
    ("security", ["injection", "xss", "csrf", "secret", "ssrf", "token", "password", "hash"],
     "A sensitive area must always trigger security-tester in ship-feature; add the preventive rule to the relevant stack's pattern skill."),
    ("transaction/concurrency", ["race", "concurren", "transaksi", "transaction", "atomic", "idempoten", "deadlock", "lock"],
     "Before the first edit, the engineer must have settled the transaction boundary and idempotency for every multi-step write."),
    ("validation", ["validasi", "validation", "sanitiz", "sanitasi", "input"],
     "Boundary validation must be derived from the contract field by field, with one negative test per rule."),
    ("contract", ["kontrak", "contract", "spec", "status code", "response", "field", "tipe", "type mismatch"],
     "The engineer must compare the actual response against the contract examples (path, fields, status, errors) before reporting."),
    ("ui-state", ["loading", "empty", "error state", "disabled", "double submit", "state ui", "retry"],
     "A frontend report must give evidence for each UI state (loading/empty/error/disabled), not just a list of what was 'handled'."),
    ("accessibility", ["aksesibilitas", "a11y", "aria", "keyboard", "fokus", "focus", "label", "kontras"],
     "Frontend self-review must check labels, focus order, and keyboard navigation for every new interactive component."),
    ("performance", ["n+1", "index", "performa", "performance", "lambat", "slow", "query dalam loop"],
     "Backend self-review must check for queries/I-O inside loops and for indexes on new filter columns."),
]
CAT_SARAN = {c: s for c, _, s in CATEGORIES}
CAT_SARAN["other"] = "Uncategorised: read the finding text in findings.csv. If the pattern shows up across several projects, turn it into a general self-review checklist rule."

# Causes of a failing test/build. agent=True means the agent's code is at fault; False means the project environment.
BUILD_CAUSES = [
    ("environment", False, re.compile(r"(ECONNREFUSED|connection refused|could not connect|command not found|is not recognized|"
                                     r"permission denied|timed? ?out|no space left|network|docker|ENOENT|address already in use)", re.I),
     "Not the agent's code. Make sure the test commands & prerequisites (DB, services) are written in the project's CLAUDE.md."),
    ("compilation/type", True, re.compile(r"(error (CS|TS)\d+|SyntaxError|TypeError|cannot find symbol|undefined (reference|method|variable)|"
                                        r"is not defined|has no attribute|ImportError|ModuleNotFoundError|Cannot find module|compil)", re.I),
     "The agent wrote a lot of code before checking that it compiles. General rule: run build/type-check after each file is finished, before the tests."),
    ("failing-test", True, re.compile(r"(Assert|Expected|AssertionError|FAIL|Failed|✕|×|not ok)", re.I),
     "The agent only ran tests at the end. General rule: write/run the test for the AC being worked on before moving to the next one."),
    ("lint", True, re.compile(r"(lint|eslint|ruff|prettier|stylecop|warning as error)", re.I),
     "Run the formatter/lint on the changed files before a full build, or add an automatic formatting hook to the project."),
]


def build_cause(text):
    lines = [l.strip() for l in (text or "").splitlines() if l.strip() and not re.match(r"^(Error: )?Exit code \d+$", l.strip())]
    for cause, fault, rx, _ in BUILD_CAUSES:
        for l in lines:
            if rx.search(l):
                return cause, fault, l[:90]
    return "other", True, (lines[0][:90] if lines else "(empty output)")


def _has(t, word):
    return re.search(r"(?<![a-z0-9])" + re.escape(word), t) is not None


def _match(t, key):
    if isinstance(key, tuple):
        return all(any(_has(t, w) for w in group) for group in key)
    return _has(t, key)


def categorize(text):
    t = text.lower()
    for cat, keys, _ in CATEGORIES:
        if any(_match(t, k) for k in keys):
            return cat
    return "other"


def owner_of(path, rest):
    m = re.search(r"→\s*`?([\w-]+-engineer)", rest)
    if m:
        return m.group(1)
    if DEVOPS_PATH.search(path):
        return "devops-engineer"
    if path.lower().split(":")[0].endswith(FE_EXT):
        return "frontend-engineer"
    return "backend-engineer"


def parse_findings(report, source_agent, call_no):
    out = []
    for line in (report or "").splitlines():
        m = FINDING.match(line)
        if not m:
            continue
        fid, path, rest = m.group("id"), m.group("path"), m.group("rest")
        head = rest.lower()[:40]
        if fid.startswith("CR-"):
            blocking = "🔴" in rest or "blocking" in head
        elif fid.startswith("SEC-"):
            blocking = bool(re.search(r"\b(critical|high)\b", head))
        else:
            blocking = "🔴" in rest or bool(re.search(r"\b(critical|high)\b", head))
        text = re.sub(r"^[^\w`]*(blocking|suggestion|question|nit|critical|high|medium|low)[^:]*:\s*", "", rest, flags=re.I)
        out.append({"id": fid, "path": path, "file": path.split(":")[0], "blocking": blocking,
                    "owner": owner_of(path, rest), "category": categorize(text), "text": text.strip()[:160],
                    "source": source_agent, "call": call_no})
    return out


def near_limit(c, agent):
    """A run with no Status/decision line whose turn count is already at the maxTurns limit."""
    mt = max_turns_of(agent)
    return bool(mt and (c.get("run_turns") or 0) >= mt - 1)


def analyse_failures(call_infos):
    """call_infos: list of (call dict, Stream|None) in call order."""
    f = {"status": defaultdict(list), "verdict": defaultdict(list), "findings": [], "returned": Counter(),
         "build_fail": {}, "reappeared": [], "limit": Counter()}
    seen_calls = Counter()
    for c, stream in call_infos:
        agent = c["type"]
        seen_calls[agent] += 1
        n = seen_calls[agent]
        report = c.get("report") or (stream.text_in(*stream.runs[0]) if stream else "")
        hit = bool(c.get("limit_hit"))
        if agent in ENGINEERS:
            m = STATUS.search("\n".join(report.strip().splitlines()[:3]))
            hit = hit or (not m and near_limit(c, agent))
            prev = f["status"][agent][-1][0] if f["status"][agent] else None
            prompt = (c.get("prompt") or "").lower()
            # Re-invoked after `done` without Fix mode and not the next slice = the report was sent back.
            # After maxTurns/partial/needs-decision/blocked/too-big = continuing the work, not a failure.
            if n > 1 and prev == MAXTURNS:
                label = "continued-maxTurns"
            elif FIX_MODE.search(prompt):
                label = "fix"
            elif n > 1 and prev == "done":
                label = "next slice" if NEXT_SLICE.search(prompt) else "returned"
            elif n > 1:
                label = "continued"
            else:
                label = ""
            f["status"][agent].append((MAXTURNS if hit else (m.group(1).lower() if m else None), label))
            if label == "returned":
                f["returned"][agent] += 1
        if agent in VERIFIERS:
            m = VERDICT.search("\n".join(report.strip().splitlines()[:3]))
            hit = hit or (not m and near_limit(c, agent))
            found = parse_findings(report, agent, n)
            nb = sum(1 for x in found if x["blocking"])
            v = re.split(r"\s+[—-]\s+|:", m.group(2))[0].strip()[:40] if m else (MAXTURNS if hit else None)
            f["verdict"][agent].append((v, nb, len(found) - nb))
            earlier = {(x["source"], x["file"], x["category"]) for x in f["findings"] if x["blocking"]}
            for x in found:
                if x["blocking"] and n > 1 and (x["source"], x["file"], x["category"]) in earlier:
                    f["reappeared"].append(x)
            f["findings"] += found
        if hit:
            f["limit"][agent] += 1
        if stream:
            causes, last_err = [], None
            for _, kind, data in stream.events:
                if kind == "tool_result" and data[0] == "Bash" and BUILD_CMD.search(str(data[1].get("command", ""))):
                    last_err = data[4]
                    if data[4]:
                        causes.append(build_cause(data[5]))
            if causes:
                prev = f["build_fail"].get(agent, ([], None))
                f["build_fail"][agent] = (prev[0] + causes, last_err)
    return f


def render_failures(f):
    lines = []
    for agent, sts in f["status"].items():
        parts = []
        for st, label in sts:
            st = "⚠ stopped at maxTurns" if st == MAXTURNS else st
            parts.append((st or "⚠ no Status line") + (f" ({label})" if label else ""))
        lines.append(f"- **{agent}**: " + " → ".join(parts))
    for agent, vs in f["verdict"].items():
        parts = [f"{'⚠ stopped at maxTurns' if v == MAXTURNS else v or '⚠ no decision'} ({nb} blocking, {nn} other)"
                 for v, nb, nn in vs]
        lines.append(f"- **{agent}**: " + " → ".join(parts))
    blocking = [x for x in f["findings"] if x["blocking"]]
    if blocking:
        per = defaultdict(Counter)
        for x in blocking:
            per[x["owner"]][x["category"]] += 1
        for owner, cats in per.items():
            lines.append(f"- Blocking for **{owner}**: " + " · ".join(f"{c} {n}" for c, n in cats.most_common()))
    for agent, (causes, last_err) in f["build_fail"].items():
        lines.append(f"- **{agent}**: test/build failed {len(causes)}x inside the agent, " + ("⚠ ended red" if last_err else "green in the end"))
        for cause, _, ev in list(dict.fromkeys(causes))[:2]:
            lines.append(f"  ↳ {cause}: `{ev}`")
        repeated = [ev for ev, n in Counter(ev for _, _, ev in causes).items() if n >= 2]
        if repeated:
            lines.append(f"  ↳ the same error appeared {max(Counter(ev for _, _, ev in causes).values())}x")
    for agent, n in f["returned"].items():
        lines.append(f"- **{agent}**: re-invoked {n}x without \"Fix mode\" (report sent back by the orchestrator)")
    for x in f["reappeared"]:
        lines.append(f"- ⚠ Finding reappeared after the fix: {x['id']} `{x['path']}` ({x['category']})")
    return lines


def failure_saran(f):
    out = []
    for agent, sts in f["status"].items():
        if any(st is None for st, _ in sts):
            out.append((agent, "No Status line", "The agent stopped without a formatted report (it may have hit maxTurns). Check its Report section and turn budget."))
        if any(st in ("blocked", "needs-decision") for st, _ in sts):
            out.append((agent, "Blocked/needs-decision", "The decision the engineer asked about should already have been in the spec. Add it to Decisions & assumptions in the next brief."))
        if any(st == "too-big" for st, _ in sts):
            out.append((agent, "Too-big", "Split the work smaller at ship-feature's sizing stage."))
    for agent in f["limit"]:
        out.append((agent, "Stopped at maxTurns", "The run stopped at maxTurns with no final report. The scope per call is too large (split it per slice), or the turn checkpoint in the agent file was not followed."))
    for agent in f["returned"]:
        out.append((agent, "Report sent back", "The report did not meet the requirements (e.g. the AC → test map was missing). Make sure the Report template in the agent file is followed."))
    for agent, (causes, last_err) in f["build_fail"].items():
        if last_err and causes[-1][1]:
            out.append((agent, "Test/build ended red", "The agent reported with a red test/build. The Verification gate in the agent file was not honoured."))
        per_cause = Counter(c for c, _, _ in causes)
        for cause, fault, _ in dict.fromkeys(causes):
            saran = next(t for c, _, _, t in BUILD_CAUSES if c == cause) if cause != "other" else None
            # One failure mid-iteration is normal; only suggest when it recurs, ends red, or is environmental.
            if saran and (per_cause[cause] >= 2 or (last_err and causes[-1][0] == cause) or not fault):
                target = agent if fault else "project"
                out.append((target, f"Test/build failed: {cause}", saran))
        counts = Counter(ev for _, _, ev in causes)
        if counts and max(counts.values()) >= 2:
            out.append((agent, "Same error recurring", "The agent retried without diagnosing. General rule: the same error twice → stop, use analytical-thinking, then change the code."))
    if f["reappeared"]:
        owners = {x["owner"] for x in f["reappeared"]}
        for o in owners:
            out.append((o, "Finding reappeared", "The fix did not address the root cause. In Fix mode, require a regression test that reproduces the finding before the fix."))
    return out


def log_findings(log_dir, run_key, f, scope, project):
    """Log findings to findings.csv and return the patterns recurring across workflows."""
    path = os.path.join(log_dir, "findings.csv")
    history = []
    logged = False
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                if r.get("run") == run_key:
                    logged = True
                    continue
                history.append(r)
    try:
        if not logged and f["findings"]:
            os.makedirs(log_dir, exist_ok=True)
            new = not os.path.exists(path)
            with open(path, "a", newline="", encoding="utf-8") as fh:
                w = csv.writer(fh)
                if new:
                    w.writerow(["date", "run", "project", "scope", "source", "id", "blocking", "owner", "category", "path", "text"])
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                for x in f["findings"]:
                    w.writerow([now, run_key, project, scope, x["source"], x["id"], int(x["blocking"]), x["owner"],
                                x["category"], x["path"], x["text"]])
    except OSError:
        pass
    runs = list(dict.fromkeys(r["run"] for r in history))[-4:] + [run_key]
    by_key = defaultdict(lambda: {"runs": set(), "projects": set(), "ev": []})
    for r in history:
        if r["run"] in runs and r.get("blocking") == "1":
            k = by_key[(r["owner"], r["category"])]
            k["runs"].add(r["run"])
            k["projects"].add(r.get("project") or "?")
            k["ev"].append((r.get("project") or "?", r["id"], os.path.basename(r["path"].split(":")[0]), r["text"]))
    for x in f["findings"]:
        if x["blocking"]:
            k = by_key[(x["owner"], x["category"])]
            k["runs"].add(run_key)
            k["projects"].add(project)
            k["ev"].append((project, x["id"], os.path.basename(x["file"]), x["text"]))
    pola = []
    for (owner, cat), k in by_key.items():
        if len(k["runs"]) >= 2 and (run_key in k["runs"] or len(k["runs"]) >= 3):
            ev = list(dict.fromkeys(k["ev"]))[-2:]
            pola.append((owner, cat, len(k["runs"]), len(runs), len(k["projects"]), ev))
    return sorted(pola, key=lambda p: -p[2])


# ---------------------------------------------------------------------------
# Per-workflow summary: the basis for comparing engineer models (cost per feature, not per token)

RUN_FIELDS = ["date", "run", "project", "scope", "engineer_model", "usd", "fix_rounds", "reverify", "blocking", "returned"]


def run_summary(table, f, total_usd):
    models = sorted({model for name, model, *_ in table if name in ENGINEERS and model not in (None, "?")})
    return {"engineer_model": "+".join(models) or "-", "usd": f"{total_usd:.4f}",
            "fix_rounds": sum(1 for sts in f["status"].values() for _, label in sts if label == "fix"),
            "reverify": sum(max(len(vs) - 1, 0) for vs in f["verdict"].values()),
            "blocking": sum(1 for x in f["findings"] if x["blocking"]),
            "returned": sum(f["returned"].values())}


def log_run(log_dir, run_key, scope, project, summary):
    path = os.path.join(log_dir, "runs.csv")
    try:
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                if any(r.get("run") == run_key for r in csv.DictReader(fh)):
                    return
        os.makedirs(log_dir, exist_ok=True)
        new = not os.path.exists(path)
        with open(path, "a", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=RUN_FIELDS)
            if new:
                w.writeheader()
            w.writerow({"date": datetime.now(timezone.utc).isoformat(timespec="seconds"), "run": run_key,
                        "project": project, "scope": scope, **summary})
    except OSError:
        pass


def compare_runs(log_dir):
    path = os.path.join(log_dir, "runs.csv")
    rows = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            rows = [r for r in csv.DictReader(fh) if r.get("engineer_model") not in (None, "", "-")]
    if not rows:
        return f"No workflow in {path} has used an engineer yet. Run ship-feature a few times first."
    groups = defaultdict(list)
    for r in rows:
        groups[r["engineer_model"]].append(r)

    def avg(rs, key):
        return sum(float(r.get(key) or 0) for r in rs) / len(rs)

    out = ["## Engineer model comparison (average per workflow)", "",
           "| Engineer model | Workflows | ≈ $ | Fix rounds | Re-verifications | Blocking findings | Reports sent back |",
           "|---|---|---|---|---|---|---|"]
    for model, rs in sorted(groups.items(), key=lambda g: avg(g[1], "usd")):
        out.append(f"| {model} | {len(rs)} | {fmt_usd(avg(rs, 'usd'))} | {avg(rs, 'fix_rounds'):.1f} | "
                   f"{avg(rs, 'reverify'):.1f} | {avg(rs, 'blocking'):.1f} | {avg(rs, 'returned'):.1f} |")
    few = sorted(m for m, rs in groups.items() if len(rs) < 3)
    if few:
        out += ["", f"Not enough data for {', '.join(few)}: wait for at least 3 workflows per model, with comparable feature sizes."]
    return "\n".join(out)


def utf8_output():
    """The Windows console defaults to cp1252, which cannot print characters such as ≈ and →."""
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError, OSError):
            pass


def main():
    utf8_output()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--transcript")
    ap.add_argument("--workflow", default="ship-feature")
    ap.add_argument("--since")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--no-log", action="store_true")
    ap.add_argument("--top", type=int, default=6)
    ap.add_argument("--compare", action="store_true")
    a = ap.parse_args()
    if a.compare:
        print(compare_runs(os.path.join(config_dir(), "doz-agent")))
        return

    transcript = a.transcript or find_transcript()
    entries = load_jsonl(transcript)
    scoped, scope = slice_workflow(entries, a.workflow, a.since, a.all)
    if not scoped:
        sys.exit("No entries in scope.")

    main_stream = Stream("main", scoped)
    rows = [("main", main_stream, 1)]
    gaps = analyse(main_stream, "main", True)

    grouped = defaultdict(list)
    missing = []
    call_infos = []
    by_root = {}  # originating call id -> [stream, continued runs]
    for c in collect_calls(scoped):
        root = c.get("resume_of")
        if root:
            # A continued run's tokens are already in the originating call's transcript. A message to an
            # agent still running, or an unfinished run (no notification), does not count as a run.
            if c["report"] is not None:
                call_infos.append((c, None))
                by_root.setdefault(root["id"], [None, []])[1].append(c)
            continue
        ents = find_subagent_entries(transcript, entries, c)
        stream = Stream(c["type"], ents) if ents else None
        by_root.setdefault(c["id"], [None, []])[0] = stream
        if stream:
            c["run_turns"] = stream.turns  # updated below if the agent is continued
        call_infos.append((c, stream))
        if stream:
            grouped[c["type"]].append(stream)
        else:
            missing.append(c)
    for stream, resumed in by_root.values():
        if stream and resumed:
            stream.split_runs([r["prompt"] for r in resumed])
            split = len(stream.runs) == 1 + len(resumed)
            # Turns per run can only be trusted if the continued runs were split successfully.
            resumed[0]["resume_of"]["run_turns"] = stream.runs[0][1] - stream.runs[0][0] if split else None
            for k, r in enumerate(resumed, 1):
                if split:
                    r["run_turns"] = stream.runs[k][1] - stream.runs[k][0]
                if not r["report"] and len(stream.runs) > k:
                    r["report"] = stream.text_in(*stream.runs[k])
    fails = analyse_failures(call_infos)
    for agent, n in fails["limit"].items():
        g = next((g for g in gaps if g["agent"] == agent and g["rule"] == "Hampir kehabisan turn"), None)
        if g:
            g["detail"] += f", stopped at maxTurns {n}x"
        else:
            gaps.append({"agent": agent, "rule": "Nearly out of turns", "usd": 0.0, "detail": f"stopped at maxTurns {n}x",
                         "saran": "The scope is too broad for one call. Split it per slice and make sure the turn checkpoint in the agent file is followed."})
    for agent_type, streams in grouped.items():
        for s in streams:
            gaps += analyse(s, agent_type, False)
        # New calls to the same agent, plus continued runs that are a fix or a re-verification.
        # A continuation after needs-decision/blocked/too-big is remaining work, not a repeat.
        resumed = sum(len(s.resumes) for s in streams)
        repeats, usd = len(streams) - 1, sum(s.cost() or 0 for s in streams[1:])
        for s in streams:
            split = len(s.runs) == 1 + len(s.resumes)
            for k, prompt in enumerate(s.resumes, 1):
                if agent_type in VERIFIERS or FIX_MODE.search(prompt or ""):
                    repeats += 1
                    usd += (s.cost(*s.runs[k]) or 0) if split else 0
        if repeats:
            via = f", {resumed} continued via SendMessage" if resumed else ""
            gaps.append({"agent": agent_type, "rule": "Invoked repeatedly", "usd": usd,
                         "detail": f"{len(streams) + resumed} calls{via} (fix/re-verification rounds)",
                         "saran": "Look at the findings that triggered the extra rounds. If the pattern recurs, add it to the engineer's self-review checklist."})
        rows.append((agent_type, streams, len(streams) + resumed))

    # Per-agent table
    table = []
    grand = Counter()
    grand_usd = 0.0
    for name, obj, calls in rows:
        streams = obj if isinstance(obj, list) else [obj]
        t = Counter()
        usd = 0.0
        turns = 0
        for s in streams:
            t.update(s.totals())
            usd += s.cost() or 0
            turns += s.turns
        grand.update(t)
        grand_usd += usd
        table.append((name, short_model(streams[0].model), calls, turns, t, usd))
    for c in missing:
        r = c.get("result") or {}
        usage = r.get("usage") or {}
        t = Counter(input=usage.get("input_tokens", 0) or 0, output=usage.get("output_tokens", 0) or 0,
                    cache_read=usage.get("cache_read_input_tokens", 0) or 0,
                    cache_write=usage.get("cache_creation_input_tokens", 0) or 0)
        grand.update(t)
        table.append((c["type"] + "*", "?", 1, "?", t, None))

    start = next((parse_ts(e.get("timestamp", "")) for e in scoped if e.get("timestamp")), None)
    end = next((parse_ts(e.get("timestamp", "")) for e in reversed(scoped) if e.get("timestamp")), None)
    dur = f", {int((end - start).total_seconds() // 60)} min" if start and end else ""

    out = [f"## Token audit: {scope}{dur}",
           f"Total ≈ {fmt_usd(grand_usd)} (API list prices; Pro/Max subscriptions are not billed per token, use this for comparison only)",
           "",
           "| Agent | Model | Calls | Turns | Output | Cache read | Cache write | Input | ≈ $ | % |",
           "|---|---|---|---|---|---|---|---|---|---|"]
    for name, model, calls, turns, t, usd in sorted(table, key=lambda r: -(r[5] or 0)):
        pct = f"{(usd or 0) / grand_usd * 100:.0f}%" if grand_usd and usd is not None else "–"
        out.append(f"| {name} | {model} | {calls} | {turns} | {fmt_k(t['output'])} | {fmt_k(t['cache_read'])} | "
                   f"{fmt_k(t['cache_write'])} | {fmt_k(t['input'])} | {fmt_usd(usd)} | {pct} |")
    out.append(f"| **Total** | | | | {fmt_k(grand['output'])} | {fmt_k(grand['cache_read'])} | {fmt_k(grand['cache_write'])} | "
               f"{fmt_k(grand['input'])} | {fmt_usd(grand_usd)} | |")
    if missing:
        out.append("\n\\* Subagent transcript not found; figures come from the Agent result summary, with no gap analysis.")

    # Biggest gaps
    gaps.sort(key=lambda g: -g["usd"])
    costed = [g for g in gaps if g["usd"] >= 0.005][:a.top]
    signals = [g for g in gaps if g["usd"] < 0.005]
    if gaps:
        if costed:
            out += ["", "### Biggest gaps (ordered by estimated impact)"]
            for i, g in enumerate(costed, 1):
                out.append(f"{i}. **{g['agent']}**: {g['rule']}: {g['detail']} · ≈ ${g['usd']:.2f}")
        if signals:
            out += ["", "Other signals: " + " · ".join(f"**{g['agent']}** {g['rule'].lower()} ({g['detail']})" for g in signals[:4])]
        gaps = costed + signals
    else:
        out += ["", "No wasteful pattern crossed the threshold."]

    fail_lines = render_failures(fails)
    if fail_lines:
        out += ["", "### Failures & findings"] + fail_lines

    sid = os.path.splitext(os.path.basename(transcript))[0]
    run_key = f"{sid}|{start.isoformat() if start else ''}"
    log_dir = os.path.join(config_dir(), "doz-agent")
    project = next((os.path.basename(e["cwd"]) for e in scoped if e.get("cwd")), "?")
    pola = [] if a.no_log else log_findings(log_dir, run_key, fails, scope, project)
    if pola:
        out += ["", "### Recurring failure patterns"]
        for owner, cat, n, total, nproj, ev in pola:
            lintas = f", {nproj} projects" if nproj > 1 else ""
            out.append(f"- **{owner}** · {cat}: blocking in {n} of the last {total} workflows{lintas}")
            for proj, fid, fname, text in ev:
                out.append(f"  ↳ {proj} {fid} {fname}: {text[:70]}")

    def target_of(agent):
        if agent == "project":
            return "the project's CLAUDE.md (not an agent)"
        return "main thread / workflow skill" if agent == "main" else f"`plugins/agents/{agent}.md`"

    saran = [(owner, f"Recurring pattern: {cat}", CAT_SARAN.get(cat, CAT_SARAN["other"])) for owner, cat, *_ in pola]
    saran += failure_saran(fails)
    seen = set()
    for g in gaps:
        key = (g["agent"], g["rule"])
        if key not in seen and len(seen) < a.top:
            seen.add(key)
            saran.append((g["agent"], g["rule"], g["saran"]))
    saran = list(dict.fromkeys(saran))
    if saran:
        out += ["", "### Suggested fixes (failures first, then tokens)"]
        for agent, rule, text in saran:
            out.append(f"- {target_of(agent)} · **{rule}**: {text}")

    # Trend log
    if not a.no_log:
        log = os.path.join(log_dir, "token-audit.csv")
        prev = defaultdict(list)
        logged = False
        if os.path.exists(log):
            with open(log, encoding="utf-8") as f:
                for r in csv.DictReader(f):
                    if r.get("run") == run_key:
                        logged = True
                        continue
                    try:
                        prev[r["agent"]].append(float(r["usd"]))
                    except (KeyError, ValueError):
                        pass
        trend = []
        for name, model, calls, turns, t, usd in table:
            hist = prev.get(name, [])[-5:]
            if usd is not None and len(hist) >= 2:
                avg = sum(hist) / len(hist)
                if avg > 0:
                    trend.append(f"{name} {fmt_usd(usd)} ({(usd - avg) / avg * 100:+.0f}% vs the average of {len(hist)} runs)")
        if trend:
            out += ["", "Trend: " + " · ".join(trend)]
        try:
            if logged:
                raise OSError("already logged")
            os.makedirs(log_dir, exist_ok=True)
            new = not os.path.exists(log)
            with open(log, "a", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                if new:
                    w.writerow(["date", "run", "scope", "agent", "model", "calls", "turns",
                                "output", "cache_read", "cache_write", "input", "usd"])
                now = datetime.now(timezone.utc).isoformat(timespec="seconds")
                for name, model, calls, turns, t, usd in table:
                    w.writerow([now, run_key, scope, name, model, calls, turns, t["output"], t["cache_read"],
                                t["cache_write"], t["input"], f"{usd:.4f}" if usd is not None else ""])
        except OSError:
            pass
        log_run(log_dir, run_key, scope, project, run_summary(table, fails, grand_usd))

    print("\n".join(out))


if __name__ == "__main__":
    main()
