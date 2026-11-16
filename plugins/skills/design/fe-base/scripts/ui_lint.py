"""Greps UI source for mechanical anti-patterns a reviewer would otherwise hunt by eye.

Usage:
  python ui_lint.py <file-or-dir> [...]
  python ui_lint.py src/components src/app/page.tsx

Scans .tsx .jsx .ts .js .vue .svelte .astro .html .css .scss.
Prints `path:line  RULE  message`; exit 1 when anything is found.
Findings are candidates: a hit in a comment or a deliberate, documented case is fine to skip.
Rule list adapted from Vercel's Web Interface Guidelines (MIT) and fe-base's own audit.
"""
import os
import re
import sys

EXT = {".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte", ".astro", ".html", ".css", ".scss"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".next", ".nuxt", "out", "coverage", ".svelte-kit"}

# (id, pattern, message, flags)
LINE_RULES = [
    ("transition-all", r"transition\s*:\s*all\b|\btransition-all\b",
     "transition: all animates layout too; list the properties (transform, opacity, color)"),
    ("zoom-disabled", r"user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b",
     "disables pinch zoom (WCAG 1.4.4); remove it"),
    ("paste-blocked", r"onPaste\s*=.*preventDefault|on:paste.*preventDefault|@paste\.prevent",
     "blocks paste; breaks password managers and OTP autofill"),
    ("div-click", r"<(div|span|li|td)\b[^>]*\s(onClick|@click|on:click|v-on:click)\s*=",
     "clickable non-button; use <button> for actions or <a> for navigation"),
    ("fake-link", r"href\s*=\s*[\"'](#|javascript:)[^\"']*[\"']",
     "link with no destination; use <button> or a real URL"),
    ("vw-width", r"(?<![-\w])(width|min-width|max-width)\s*:\s*100vw|\bw-screen\b",
     "100vw includes the scrollbar and causes sideways scroll; use 100%"),
    ("vh-height", r"(?<![-\w])(height|min-height)\s*:\s*100vh|\b(h|min-h)-screen\b",
     "100vh jumps under mobile browser bars; use 100svh/100dvh (h-svh, min-h-dvh)"),
    ("autofocus", r"\bautoFocus\b|\bautofocus\b",
     "autofocus steals focus and opens the mobile keyboard; keep only for one primary desktop input"),
    ("three-dots", r"(?:>|[\"'`])[^<>\"'`{}\n]*[A-Za-z]\.\.\.(?=\s*(?:<|[\"'`]))",
     "use the ellipsis character (U+2026) instead of three dots"),
]

OUTLINE = re.compile(r"outline\s*:\s*(none|0)\b|\boutline-none\b")
FOCUS_REPLACEMENT = re.compile(r"focus-visible|focus-within|:focus\b|focus:ring|focus:outline|ring-")
IMG = re.compile(r"<img\b[^>]*>", re.S)
PLAIN_IMG_HAS_SIZE = re.compile(r"\bwidth\s*=.*\bheight\s*=|\bheight\s*=.*\bwidth\s*=|\bfill\b|aspect-", re.S)


def files(paths):
    for p in paths:
        if os.path.isfile(p):
            yield p
            continue
        for root, dirs, names in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for n in names:
                if os.path.splitext(n)[1] in EXT:
                    yield os.path.join(root, n)


def line_of(text, index):
    return text.count("\n", 0, index) + 1


def lint(path):
    try:
        text = open(path, encoding="utf-8", errors="replace").read()
    except OSError:
        return []
    out = []
    for i, line in enumerate(text.splitlines(), 1):
        for rule, pattern, message in LINE_RULES:
            if re.search(pattern, line):
                out.append((i, rule, message))
    if not FOCUS_REPLACEMENT.search(text):
        for m in OUTLINE.finditer(text):
            out.append((line_of(text, m.start()), "outline-none",
                        "focus outline removed with no focus-visible replacement in this file"))
    for m in IMG.finditer(text):
        if not PLAIN_IMG_HAS_SIZE.search(m.group(0)):
            out.append((line_of(text, m.start()), "img-size",
                        "<img> without width and height (or aspect-ratio) shifts layout (CLS)"))
    return sorted(set(out))


def main(args):
    if not args:
        print(__doc__)
        return 2
    total = 0
    for path in files(args):
        for line, rule, message in lint(path):
            total += 1
            print(f"{path}:{line}  {rule}  {message}")
    if total:
        print(f"{total} finding(s)")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
