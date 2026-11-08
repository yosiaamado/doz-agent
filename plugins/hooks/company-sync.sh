#!/usr/bin/env bash
# Syncs <project>/company/ with the git repo named in <project>/company-repo.json.
#   pull: at session start, clone the repo into company/ or pull it.
#   push: after each turn, commit changes in company/ and push them (unless auto-push is false).
# Does nothing when company-repo.json is missing or enable-company is not true.
set -u
mode="${1:-pull}"
root="${CLAUDE_PROJECT_DIR:-$PWD}"
cfg="$root/company-repo.json"
dir="$root/company"
[ -f "$cfg" ] || exit 0

val() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\{0,1\}\([^\",}]*\).*/\1/p" "$cfg" | head -n 1 | tr -d '[:space:]'
}
[ "$(val enable-company)" = "true" ] || exit 0
repo="$(val repo)"
branch="$(val branch)"; branch="${branch:-main}"
autopush="$(val auto-push)"

export GIT_TERMINAL_PROMPT=0
run() { if command -v timeout >/dev/null 2>&1; then timeout 45 "$@"; else "$@"; fi; }
say() {
  if [ "$mode" = "pull" ]; then echo "company repo: $1"
  else printf '{"systemMessage":"company repo: %s"}\n' "$(printf '%s' "$1" | sed 's/["\\]/ /g')"; fi
}

case "$repo" in
  ""|*"<"*) say "enable-company is true but repo in company-repo.json is still a placeholder; company/ is not synced."; exit 0 ;;
esac

if [ "$mode" = "pull" ]; then
  if [ ! -d "$dir/.git" ]; then
    if [ -d "$dir" ] && [ -n "$(ls -A "$dir" 2>/dev/null)" ]; then
      say "company/ has local files but is not a clone of $repo; not synced. Move its files into the company repo, then delete company/."
      exit 0
    fi
    if err="$(run git clone -q --branch "$branch" "$repo" "$dir" 2>&1)"; then
      say "cloned $repo into company/."
    else
      say "could not clone $repo ($(printf '%s' "$err" | head -n 1)); working without company/."
    fi
  elif ! err="$(run git -C "$dir" pull -q --rebase --autostash origin "$branch" 2>&1)"; then
    say "pull failed ($(printf '%s' "$err" | head -n 1)); using the local copy of company/."
  fi
  exit 0
fi

# push
[ -d "$dir/.git" ] || exit 0
if [ -n "$(git -C "$dir" status --porcelain)" ]; then
  git -C "$dir" add -A
  if ! err="$(git -C "$dir" commit -q -m "Update from Claude Code session ($(date +%Y-%m-%d))" 2>&1)"; then
    say "commit in company/ failed ($(printf '%s' "$err" | head -n 1))."
    exit 0
  fi
fi
[ "$autopush" = "false" ] && exit 0
ahead="$(git -C "$dir" rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo 1)"
[ "$ahead" = "0" ] && exit 0
if ! err="$( { run git -C "$dir" pull -q --rebase origin "$branch" && run git -C "$dir" push -q origin "HEAD:$branch"; } 2>&1)"; then
  say "changes are committed in company/ but the push failed ($(printf '%s' "$err" | head -n 1)); it retries after the next turn."
fi
exit 0
