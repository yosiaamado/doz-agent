#!/usr/bin/env bash
# SessionStart: tells the session whether the bundled codebase graph (codebase-memory-mcp) can be used here.
# Prints one line for Claude's context only when something needs doing; silent when all is well.
# Never installs or indexes anything itself.
set -u
VERSION="0.12.1"
root="${CLAUDE_PROJECT_DIR:-$PWD}"

# Only code repositories benefit from a graph.
git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

if ! command -v npx >/dev/null 2>&1; then
  echo "doz-agent: the code graph (codebase-memory-mcp) is off because Node.js/npx is not installed. Agents fall back to Grep. To turn it on, the user installs Node.js 18+ from nodejs.org and restarts Claude Code."
  exit 0
fi

run() { if command -v timeout >/dev/null 2>&1; then timeout 20 "$@"; else "$@"; fi; }
projects="$(run npx -y "codebase-memory-mcp@$VERSION" cli --quiet list_projects --format json 2>/dev/null)" || {
  echo "doz-agent: the code graph (codebase-memory-mcp@$VERSION) did not answer at session start (first run downloads it, or the download was blocked). Agents fall back to Grep."
  exit 0
}

# Compare paths with forward slashes and without a trailing slash; case-insensitive for Windows drives.
norm() { printf '%s' "$1" | sed -e 's#\\#/#g' -e 's#/*$##' -e 's#^/\([a-zA-Z]\)/#\1:/#' | tr '[:upper:]' '[:lower:]'; }
shown="$(cd "$root" && pwd -W 2>/dev/null || pwd)"
want="$(norm "$shown")"
if printf '%s' "$projects" | sed 's#\\\\#/#g' | tr '[:upper:]' '[:lower:]' | grep -q "\"root_path\":\"$want/\{0,1\}\""; then
  exit 0
fi

echo "doz-agent: this repository has no code graph yet. Before dispatching engineers or reviewers on code work here, index it once with the codebase-memory index_repository tool (repo_path: $shown, async: true for a large repo). Until then agents fall back to Grep."
