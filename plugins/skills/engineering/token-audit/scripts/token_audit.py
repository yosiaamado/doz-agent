#!/usr/bin/env python3
"""Token & failure audit untuk satu workflow Claude Code (misalnya /ship-feature).

Membaca transcript JSONL Claude Code, menghitung token per agent dari angka
`usage` API (persis), mencari pola boros (perkiraan ukuran hasil tool =
karakter / 4), membaca kegagalan dari format laporan agent (Status, Keputusan,
temuan CR-n/QA-BUG-n/SEC-n, test/build yang gagal), lalu memberi saran
perbaikan per agent. Temuan dicatat ke findings.csv untuk mendeteksi pola
kegagalan yang berulang lintas workflow.

Pemakaian:
  token_audit.py                      # workflow terakhir (default: ship-feature) di session terbaru
  token_audit.py --workflow NAMA      # workflow terakhir dengan skill NAMA
  token_audit.py --all                # seluruh session
  token_audit.py --since 2026-09-23T10:00:00Z
  token_audit.py --transcript PATH    # transcript tertentu
  token_audit.py --no-log             # jangan tulis ke log tren
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

# Harga list API per 1 juta token: (input, output, cache read).
# Cache write = 1.25x input (TTL 5 menit) atau 2x input (TTL 1 jam).
# Perbarui kalau harga berubah. Langganan Pro/Max tidak ditagih per token,
# jadi angka $ di laporan hanya pembanding antar agent.
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

# Ambang pola boros
BIG_READ = 3000        # token, satu Read tanpa offset/limit
BIG_BASH = 1500        # token, satu output Bash
BIG_SKILL = 3000       # token, satu skill yang dimuat
LONG_REPORT = 700      # token, laporan akhir subagent (~500 kata)
NARRATION = 400        # token, total teks di antara tool call
SEARCH_BEFORE_EDIT = 12
SEARCH_READ_ONLY = 20
CACHE_MISS = 30000     # token cache write pada turn lanjutan
MAIN_CONTEXT = 150000  # token konteks thread utama di akhir workflow


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
        sys.exit(f"Transcript tidak ditemukan di {projects}. Pakai --transcript PATH.")
    return max(cands, key=os.path.getmtime)


class Stream:
    """Satu thread (main atau satu panggilan subagent) beserta statistiknya."""

    def __init__(self, name, entries):
        self.name = name
        self.model = None
        self.usage = {}        # message.id -> usage (terakhir menang)
        self.order = []        # urutan message.id
        self.ts = {}           # message.id -> timestamp
        self.events = []       # (turn_idx, kind, data)
        self.final_text = ""
        self._build(entries)

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
                if isinstance(content, list):
                    for b in content:
                        if isinstance(b, dict) and b.get("type") == "tool_result":
                            name, inp = tool_uses.get(b.get("tool_use_id"), ("?", {}))
                            body = text_of(b.get("content"))
                            err = bool(b.get("is_error")) or bool(re.match(r"\s*(Error: )?Exit code [1-9]", body))
                            snippet = body if len(body) <= 6000 else body[:3000] + "\n" + body[-3000:]
                            self.events.append((turn, "tool_result", (name, inp, tok(b.get("content")), e, err, snippet if err else "")))
                txt = text_of(content)
                if txt.startswith("Base directory for this skill"):
                    m = re.search(r"skills?/(?:[^/\s]+/)*([^/\s]+)\s", txt)
                    self.events.append((turn, "skill", (m.group(1) if m else "skill", tok(txt))))

    @property
    def turns(self):
        return len(self.order)

    def totals(self):
        t = Counter()
        for u in self.usage.values():
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

    def cost(self):
        p = price_for(self.model)
        if not p:
            return None
        pin, pout, pread = p
        t = self.totals()
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
        """Perkiraan biaya satu blok konteks: ditulis sekali ke cache lalu dibaca tiap turn berikutnya."""
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
        return main, "seluruh session"
    if since:
        s = parse_ts(since)
        return [e for e in main if (parse_ts(e.get("timestamp", "")) or s) >= s], f"sejak {since}"
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
        return main, f"seluruh session (workflow `{workflow}` tidak ditemukan)"
    return main[start:], f"workflow `{workflow}`"


def find_subagent_entries(transcript, all_entries, call):
    """Cari transcript subagent: file subagents/, lalu sidechain inline."""
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


def collect_calls(main_entries):
    calls = []
    by_id = {}
    for e in main_entries:
        msg = e.get("message") or {}
        if e.get("type") == "assistant":
            for b in msg.get("content") or []:
                if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") in AGENT_TOOLS:
                    inp = b.get("input") or {}
                    c = {"id": b.get("id"), "type": str(inp.get("subagent_type") or "general-purpose").split(":")[-1],
                         "prompt": inp.get("prompt", ""), "agent_id": None, "result": None}
                    calls.append(c)
                    by_id[c["id"]] = c
        elif e.get("type") == "user" and isinstance(msg.get("content"), list):
            for b in msg["content"]:
                if isinstance(b, dict) and b.get("type") == "tool_result" and b.get("tool_use_id") in by_id:
                    c = by_id[b["tool_use_id"]]
                    c["report"] = text_of(b.get("content"))
                    r = e.get("toolUseResult")
                    if isinstance(r, dict):
                        c["agent_id"] = r.get("agentId") or c["agent_id"]
                        c["result"] = r
    return calls


def max_turns_of(agent_type):
    here = os.path.dirname(os.path.abspath(__file__))
    for up in range(1, 7):
        cand = os.path.join(here, *([".."] * up), "agents", f"{agent_type}.md")
        if os.path.exists(cand):
            m = re.search(r"^maxTurns:\s*(\d+)", open(cand, encoding="utf-8").read(), re.M)
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
                    add("Read utuh file besar", usd, f"`{os.path.basename(path)}` ~{size/1000:.1f}k tok, terbawa {rem} turn",
                        "Grep simbolnya dulu, lalu Read dengan offset/limit. Kalau file ini selalu dibutuhkan, tulis path + bagian pentingnya di Peta file/memory.")
            elif name == "Bash" and size >= BIG_BASH:
                usd, rem = stream.carry_usd(size, turn)
                cmd = re.sub(r"\s+", " ", str(inp.get("command", "")))[:60]
                add("Output command besar", usd, f"`{cmd}` ~{size/1000:.1f}k tok, terbawa {rem} turn",
                    "Filter output: mode quiet, `| tail -n 40`, `--stat`, atau filter test per file/nama.")
            elif name in AGENT_TOOLS and is_main and size >= LONG_REPORT:
                usd, rem = stream.carry_usd(size, turn)
                add("Laporan subagent panjang", usd, f"laporan ~{size} tok masuk ke thread utama, terbawa {rem} turn",
                    "Agent tidak mengikuti batas/format laporan. Perketat bagian Laporan di file agent-nya.")
        elif kind == "skill":
            name, size = data
            if size >= BIG_SKILL:
                usd, rem = stream.carry_usd(size, turn)
                add("Skill besar dimuat", usd, f"`{name}` ~{size/1000:.1f}k tok, terbawa {rem} turn",
                    "Pecah skill: isi inti tetap di SKILL.md, detail ke references/ yang dibaca hanya kalau perlu.")

    for path, n in reads.items():
        if n >= 2:
            add("File dibaca ulang", reread_usd[path], f"`{os.path.basename(path)}` dibaca utuh {n}x",
                "Isi file sudah ada di konteks. Kalau dibaca ulang setelah edit, cukup baca bagian yang diubah.")

    limit = SEARCH_READ_ONLY if agent_type in READ_ONLY_AGENTS or is_main else SEARCH_BEFORE_EDIT
    count = searches_total if agent_type in READ_ONLY_AGENTS or is_main else searches_before_edit
    if count >= limit:
        read_only = agent_type in READ_ONLY_AGENTS or is_main
        where = "total" if read_only else "sebelum edit pertama"
        turns_used = search_turns if read_only else search_turns_before_edit
        add("Eksplorasi panjang", sum(stream.turn_usd(t) for t in turns_used), f"{count} pencarian {where}",
            "Peta file di spec kurang lengkap, atau memory belum punya area ini. Lengkapi Peta file (path + pola acuan).")

    if narration >= NARRATION:
        p = price_for(stream.model) or PRICES["claude-sonnet-5"]
        add("Narasi di antara tool call", narration * p[1] / 1e6, f"~{narration} tok teks output di sela tool call",
            "Aturan `Gaya output` belum diikuti. Pastikan bagian itu ada di file agent-nya.")

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
        where = ", ".join(f"turn {t}" + (f" (jeda {g} mnt)" if g is not None and g >= 5 else "") for t, _, g in misses[:4])
        add("Cache miss", w_total * p[0] * 1.5 / 1e6, f"{len(misses)}x, ~{w_total/1000:.0f}k tok ditulis ulang: {where}",
            "Cache kedaluwarsa karena jeda lebih lama dari TTL" if long_gaps == len(misses) else
            "Sebagian tanpa jeda panjang: prompt awal berubah (misalnya compaction, file CLAUDE.md/memory diubah di tengah jalan) atau jeda melewati TTL. Hindari jeda panjang di tengah workflow.")

    if not is_main:
        mt = max_turns_of(agent_type)
        if mt and stream.turns >= 0.8 * mt:
            add("Hampir kehabisan turn", 0.0, f"{stream.turns}/{mt} turn",
                "Scope terlalu luas untuk satu panggilan. Pecah pekerjaannya atau perjelas brief.")
    elif stream.last_context() >= MAIN_CONTEXT:
        add("Konteks thread utama besar", 0.0, f"~{stream.last_context()/1000:.0f}k tok di akhir workflow",
            "Mulai session baru per fitur; jangan teruskan laporan agent utuh ke agent lain.")
    return gaps


def fmt_k(n):
    return f"{n/1e6:.2f}M" if n >= 1e6 else f"{n/1e3:.1f}k" if n >= 1e3 else str(n)


def fmt_usd(x):
    return "–" if x is None else f"${x:.2f}"


# ---------------------------------------------------------------------------
# Kegagalan & temuan: dibaca dari format laporan agent (Status/Keputusan/ID temuan)

ENGINEERS = {"backend-engineer", "frontend-engineer", "devops-engineer"}
VERIFIERS = {"code-reviewer", "qa-tester", "security-tester"}
FE_EXT = (".tsx", ".jsx", ".vue", ".svelte", ".css", ".scss", ".sass", ".less", ".html")
DEVOPS_PATH = re.compile(r"(Dockerfile|\.ya?ml$|\.github/|\.tf$|compose|helm/|k8s/)", re.I)
BUILD_CMD = re.compile(r"\b(test|tests|build|lint|tsc|pytest|jest|vitest|playwright|dotnet|mvn|gradle|cargo|go (test|build|vet)|npm|pnpm|yarn|make|eslint|ruff|mypy)\b")
FINDING = re.compile(r"^\s*[-*]?\s*`?(?P<id>(?:CR|QA-BUG|SEC)-\d+)`?\s+`?(?P<path>[^\s`]+?)`?:?\s+(?P<rest>.+)$")
STATUS = re.compile(r"^\W*Status:\s*\**\s*(done|blocked|needs-decision|too-big)", re.I | re.M)
VERDICT = re.compile(r"^\W*(Keputusan|Rekomendasi):\s*(.+)$", re.I | re.M)

# (kategori, kata kunci, saran). Urutan menentukan: kecocokan pertama menang.
# Saran selalu berupa aturan proses umum untuk agent, bukan perbaikan error project tertentu.
CATEGORIES = [
    ("loop/data korup", ["infinite", "loop", "rekursi", "recursion", "siklus", "cycle", "korup", "corrupt", "orphan"],
     "Jadikan wajib di self-review: setiap loop/rekursi atas data tersimpan punya batas atau visited set, plus satu test dengan data korup (siklus/orphan)."),
    ("test lama", ["test lama", "existing test", "test yang ada", "test yang sudah ada", "pasti gagal", "failing test", "snapshot", "regresi", "regression"],
     "Sebelum edit, grep test yang memakai simbol yang akan diubah dan catat di rencana; setelah edit, suite penuh wajib hijau sebelum melapor."),
    ("null/no-op", ["null", "no-op", "noop", "diam-diam", "silent", "tidak berfungsi", "tidak berefek", "undefined", "dikosongkan", "reset"],
     "Untuk setiap field yang bisa diubah, wajib ada test varian 'mengosongkan' (null / hapus / reset) sebelum implementasi dianggap selesai."),
    ("authorization/IDOR", ["idor", "authoriz", "otorisasi", "milik user lain", "role", "permission", "401", "403"],
     "Setiap endpoint baru wajib punya test akses resource milik user lain (IDOR) dan role salah, bukan hanya 401."),
    ("security", ["injection", "xss", "csrf", "secret", "ssrf", "token", "password", "hash"],
     "Area sensitif harus selalu memicu security-tester di ship-feature; tambahkan aturan pencegahannya ke skill pattern stack terkait."),
    ("transaksi/concurrency", ["race", "concurren", "transaksi", "transaction", "atomic", "idempoten", "deadlock", "lock"],
     "Desain singkat engineer wajib menyebut batas transaksi dan idempotency untuk setiap operasi tulis multi-langkah."),
    ("validasi", ["validasi", "validation", "sanitiz", "sanitasi", "input"],
     "Validasi di boundary wajib diturunkan dari kontrak per field, dengan satu test negatif per aturan."),
    ("kontrak", ["kontrak", "contract", "spec", "status code", "response", "field", "tipe", "type mismatch"],
     "Engineer wajib membandingkan response nyata dengan contoh di kontrak (path, field, status, error) sebelum melapor."),
    ("state UI", ["loading", "empty", "error state", "disabled", "double submit", "state ui", "retry"],
     "Laporan frontend wajib menyebut bukti tiap state UI (loading/empty/error/disabled), bukan hanya daftar yang 'ditangani'."),
    ("aksesibilitas", ["aksesibilitas", "a11y", "aria", "keyboard", "fokus", "focus", "label", "kontras"],
     "Self-review frontend wajib mengecek label, urutan fokus, dan navigasi keyboard untuk setiap komponen interaktif baru."),
    ("performa", ["n+1", "index", "performa", "performance", "lambat", "slow", "query dalam loop"],
     "Self-review backend wajib mengecek query/I-O di dalam loop dan index untuk kolom filter baru."),
]
CAT_SARAN = {c: s for c, _, s in CATEGORIES}
CAT_SARAN["lain"] = "Belum terkategori: baca teks temuannya di findings.csv. Kalau polanya muncul di beberapa project, jadikan aturan umum di checklist self-review."

# Penyebab test/build gagal. agent=True berarti kesalahan kode agent; False berarti lingkungan project.
BUILD_CAUSES = [
    ("lingkungan", False, re.compile(r"(ECONNREFUSED|connection refused|could not connect|command not found|is not recognized|"
                                     r"permission denied|timed? ?out|no space left|network|docker|ENOENT|address already in use)", re.I),
     "Bukan kesalahan kode agent. Pastikan perintah & prasyarat test (DB, service) tertulis di CLAUDE.md project."),
    ("kompilasi/tipe", True, re.compile(r"(error (CS|TS)\d+|SyntaxError|TypeError|cannot find symbol|undefined (reference|method|variable)|"
                                        r"is not defined|has no attribute|ImportError|ModuleNotFoundError|Cannot find module|compil)", re.I),
     "Agent menulis banyak kode sebelum mengecek kompilasi. Aturan umum: jalankan build/type-check setelah tiap file selesai, sebelum test."),
    ("test gagal", True, re.compile(r"(Assert|Expected|AssertionError|FAIL|Failed|✕|×|not ok)", re.I),
     "Agent baru menjalankan test di akhir. Aturan umum: tulis/jalankan test untuk AC yang sedang dikerjakan sebelum lanjut ke AC berikutnya."),
    ("lint", True, re.compile(r"(lint|eslint|ruff|prettier|stylecop|warning as error)", re.I),
     "Jalankan formatter/lint untuk file yang diubah sebelum build penuh, atau pasang hook format otomatis di project."),
]


def build_cause(text):
    lines = [l.strip() for l in (text or "").splitlines() if l.strip() and not re.match(r"^(Error: )?Exit code \d+$", l.strip())]
    for cause, fault, rx, _ in BUILD_CAUSES:
        for l in lines:
            if rx.search(l):
                return cause, fault, l[:90]
    return "lain", True, (lines[0][:90] if lines else "(output kosong)")


def categorize(text):
    t = text.lower()
    for cat, keys, _ in CATEGORIES:
        if any(k in t for k in keys):
            return cat
    return "lain"


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
                    "owner": owner_of(path, rest), "category": categorize(rest), "text": text.strip()[:160],
                    "source": source_agent, "call": call_no})
    return out


def analyse_failures(call_infos):
    """call_infos: list of (call dict, Stream|None) dalam urutan panggilan."""
    f = {"status": defaultdict(list), "verdict": defaultdict(list), "findings": [], "returned": Counter(),
         "build_fail": {}, "reappeared": []}
    seen_calls = Counter()
    for c, stream in call_infos:
        agent = c["type"]
        seen_calls[agent] += 1
        n = seen_calls[agent]
        report = c.get("report") or (stream.final_text if stream else "")
        if agent in ENGINEERS:
            m = STATUS.search("\n".join(report.strip().splitlines()[:3]))
            fix = "mode perbaikan" in (c.get("prompt") or "").lower()
            f["status"][agent].append((m.group(1).lower() if m else None, fix))
            if n > 1 and not fix:
                f["returned"][agent] += 1
        if agent in VERIFIERS:
            m = VERDICT.search("\n".join(report.strip().splitlines()[:3]))
            found = parse_findings(report, agent, n)
            nb = sum(1 for x in found if x["blocking"])
            f["verdict"][agent].append((re.split(r"\s+[—-]\s+|:", m.group(2))[0].strip()[:40] if m else None, nb, len(found) - nb))
            earlier = {(x["source"], x["file"], x["category"]) for x in f["findings"] if x["blocking"]}
            for x in found:
                if x["blocking"] and n > 1 and (x["source"], x["file"], x["category"]) in earlier:
                    f["reappeared"].append(x)
            f["findings"] += found
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
        for st, fix in sts:
            parts.append((st or "⚠ tanpa baris Status") + (" (perbaikan)" if fix else ""))
        lines.append(f"- **{agent}**: " + " → ".join(parts))
    for agent, vs in f["verdict"].items():
        parts = [f"{v or '⚠ tanpa keputusan'} ({nb} blocking, {nn} lain)" for v, nb, nn in vs]
        lines.append(f"- **{agent}**: " + " → ".join(parts))
    blocking = [x for x in f["findings"] if x["blocking"]]
    if blocking:
        per = defaultdict(Counter)
        for x in blocking:
            per[x["owner"]][x["category"]] += 1
        for owner, cats in per.items():
            lines.append(f"- Blocking untuk **{owner}**: " + " · ".join(f"{c} {n}" for c, n in cats.most_common()))
    for agent, (causes, last_err) in f["build_fail"].items():
        lines.append(f"- **{agent}**: test/build gagal {len(causes)}x di dalam agent, " + ("⚠ berakhir merah" if last_err else "akhirnya hijau"))
        for cause, _, ev in list(dict.fromkeys(causes))[:2]:
            lines.append(f"  ↳ {cause}: `{ev}`")
        repeated = [ev for ev, n in Counter(ev for _, _, ev in causes).items() if n >= 2]
        if repeated:
            lines.append(f"  ↳ error yang sama muncul {max(Counter(ev for _, _, ev in causes).values())}x")
    for agent, n in f["returned"].items():
        lines.append(f"- **{agent}**: dipanggil ulang {n}x tanpa \"Mode perbaikan\" (laporan dikembalikan orkestrator)")
    for x in f["reappeared"]:
        lines.append(f"- ⚠ Temuan muncul lagi setelah perbaikan: {x['id']} `{x['path']}` ({x['category']})")
    return lines


def failure_saran(f):
    out = []
    for agent, sts in f["status"].items():
        if any(st is None for st, _ in sts):
            out.append((agent, "Tanpa baris Status", "Agent berhenti tanpa laporan berformat (mungkin mentok maxTurns). Cek bagian Laporan dan budget turn-nya."))
        if any(st in ("blocked", "needs-decision") for st, _ in sts):
            out.append((agent, "Blocked/needs-decision", "Keputusan yang ditanyakan engineer seharusnya sudah ada di spec. Tambahkan ke Keputusan & asumsi di brief berikutnya."))
        if any(st == "too-big" for st, _ in sts):
            out.append((agent, "Too-big", "Pecah pekerjaan lebih kecil di tahap sizing ship-feature."))
    for agent in f["returned"]:
        out.append((agent, "Laporan dikembalikan", "Laporan belum memenuhi syarat (misalnya Peta AC → test hilang). Pastikan template Laporan di file agent diikuti."))
    for agent, (causes, last_err) in f["build_fail"].items():
        if last_err and causes[-1][1]:
            out.append((agent, "Test/build berakhir merah", "Agent melapor dengan test/build merah. Gate Verifikasi di file agent belum dipatuhi."))
        per_cause = Counter(c for c, _, _ in causes)
        for cause, fault, _ in dict.fromkeys(causes):
            saran = next(t for c, _, _, t in BUILD_CAUSES if c == cause) if cause != "lain" else None
            # Gagal sekali di tengah iterasi itu wajar; saran hanya kalau berulang, berakhir merah, atau masalah lingkungan.
            if saran and (per_cause[cause] >= 2 or (last_err and causes[-1][0] == cause) or not fault):
                target = agent if fault else "project"
                out.append((target, f"Test/build gagal: {cause}", saran))
        counts = Counter(ev for _, _, ev in causes)
        if counts and max(counts.values()) >= 2:
            out.append((agent, "Error sama berulang", "Agent mencoba ulang tanpa diagnosa. Aturan umum: error yang sama 2x → berhenti, pakai analytical-thinking, baru ubah kode."))
    if f["reappeared"]:
        owners = {x["owner"] for x in f["reappeared"]}
        for o in owners:
            out.append((o, "Temuan muncul lagi", "Perbaikan tidak menyentuh akar masalah. Di Mode perbaikan, minta regression test yang mereproduksi temuan sebelum fix."))
    return out


def log_findings(log_dir, run_key, f, scope, project):
    """Catat temuan ke findings.csv dan kembalikan pola berulang lintas workflow."""
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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--transcript")
    ap.add_argument("--workflow", default="ship-feature")
    ap.add_argument("--since")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--no-log", action="store_true")
    ap.add_argument("--top", type=int, default=6)
    a = ap.parse_args()

    transcript = a.transcript or find_transcript()
    entries = load_jsonl(transcript)
    scoped, scope = slice_workflow(entries, a.workflow, a.since, a.all)
    if not scoped:
        sys.exit("Tidak ada entri dalam scope.")

    main_stream = Stream("main", scoped)
    rows = [("main", main_stream, 1)]
    gaps = analyse(main_stream, "main", True)

    grouped = defaultdict(list)
    missing = []
    call_infos = []
    for c in collect_calls(scoped):
        ents = find_subagent_entries(transcript, entries, c)
        stream = Stream(c["type"], ents) if ents else None
        call_infos.append((c, stream))
        if stream:
            grouped[c["type"]].append(stream)
        else:
            missing.append(c)
    fails = analyse_failures(call_infos)
    for agent_type, streams in grouped.items():
        for s in streams:
            gaps += analyse(s, agent_type, False)
        if len(streams) > 1:
            gaps.append({"agent": agent_type, "rule": "Dipanggil berulang", "usd": sum(s.cost() or 0 for s in streams[1:]),
                         "detail": f"{len(streams)} panggilan (putaran perbaikan/verifikasi ulang)",
                         "saran": "Lihat temuan yang memicu putaran ulang. Kalau polanya berulang, tambahkan ke checklist self-review engineer."})
        rows.append((agent_type, streams, len(streams)))

    # Tabel per agent
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
    dur = f", {int((end - start).total_seconds() // 60)} mnt" if start and end else ""

    out = [f"## Token audit: {scope}{dur}",
           f"Total ≈ {fmt_usd(grand_usd)} (harga list API; langganan Pro/Max tidak ditagih per token, pakai sebagai pembanding)",
           "",
           "| Agent | Model | Panggilan | Turn | Output | Cache read | Cache write | Input | ≈ $ | % |",
           "|---|---|---|---|---|---|---|---|---|---|"]
    for name, model, calls, turns, t, usd in sorted(table, key=lambda r: -(r[5] or 0)):
        pct = f"{(usd or 0) / grand_usd * 100:.0f}%" if grand_usd and usd is not None else "–"
        out.append(f"| {name} | {model} | {calls} | {turns} | {fmt_k(t['output'])} | {fmt_k(t['cache_read'])} | "
                   f"{fmt_k(t['cache_write'])} | {fmt_k(t['input'])} | {fmt_usd(usd)} | {pct} |")
    out.append(f"| **Total** | | | | {fmt_k(grand['output'])} | {fmt_k(grand['cache_read'])} | {fmt_k(grand['cache_write'])} | "
               f"{fmt_k(grand['input'])} | {fmt_usd(grand_usd)} | |")
    if missing:
        out.append("\n\\* Transcript subagent tidak ditemukan; angka dari ringkasan hasil Agent, tanpa analisis gap.")

    # Gap terbesar
    gaps.sort(key=lambda g: -g["usd"])
    costed = [g for g in gaps if g["usd"] >= 0.005][:a.top]
    signals = [g for g in gaps if g["usd"] < 0.005]
    if gaps:
        if costed:
            out += ["", "### Gap terbesar (urut perkiraan dampak)"]
            for i, g in enumerate(costed, 1):
                out.append(f"{i}. **{g['agent']}**: {g['rule']}: {g['detail']} · ≈ ${g['usd']:.2f}")
        if signals:
            out += ["", "Sinyal lain: " + " · ".join(f"**{g['agent']}** {g['rule'].lower()} ({g['detail']})" for g in signals[:4])]
        gaps = costed + signals
    else:
        out += ["", "Tidak ada pola boros yang melewati ambang."]

    fail_lines = render_failures(fails)
    if fail_lines:
        out += ["", "### Kegagalan & temuan"] + fail_lines

    sid = os.path.splitext(os.path.basename(transcript))[0]
    run_key = f"{sid}|{start.isoformat() if start else ''}"
    log_dir = os.path.join(config_dir(), "doz-agent")
    project = next((os.path.basename(e["cwd"]) for e in scoped if e.get("cwd")), "?")
    pola = [] if a.no_log else log_findings(log_dir, run_key, fails, scope, project)
    if pola:
        out += ["", "### Pola kegagalan berulang"]
        for owner, cat, n, total, nproj, ev in pola:
            lintas = f", {nproj} project" if nproj > 1 else ""
            out.append(f"- **{owner}** · {cat}: blocking di {n} dari {total} workflow terakhir{lintas}")
            for proj, fid, fname, text in ev:
                out.append(f"  ↳ {proj} {fid} {fname}: {text[:70]}")

    def target_of(agent):
        if agent == "project":
            return "CLAUDE.md project (bukan agent)"
        return "thread utama / skill workflow" if agent == "main" else f"`plugins/agents/{agent}.md`"

    saran = [(owner, f"Pola berulang: {cat}", CAT_SARAN.get(cat, CAT_SARAN["lain"])) for owner, cat, *_ in pola]
    saran += failure_saran(fails)
    seen = set()
    for g in gaps:
        key = (g["agent"], g["rule"])
        if key not in seen and len(seen) < a.top:
            seen.add(key)
            saran.append((g["agent"], g["rule"], g["saran"]))
    saran = list(dict.fromkeys(saran))
    if saran:
        out += ["", "### Saran perbaikan (kegagalan dulu, lalu token)"]
        for agent, rule, text in saran:
            out.append(f"- {target_of(agent)} · **{rule}**: {text}")

    # Log tren
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
                    trend.append(f"{name} {fmt_usd(usd)} ({(usd - avg) / avg * 100:+.0f}% vs rata-rata {len(hist)} run)")
        if trend:
            out += ["", "Tren: " + " · ".join(trend)]
        try:
            if logged:
                raise OSError("sudah tercatat")
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

    print("\n".join(out))


if __name__ == "__main__":
    main()
