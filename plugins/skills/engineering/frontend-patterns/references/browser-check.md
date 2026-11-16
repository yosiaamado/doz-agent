# Browser check with playwright-cli

Read this at the verification step when the UI can run locally. Subagents have no browser tool; `playwright-cli` (Microsoft, Apache-2.0) gives them one through Bash, and returns an accessibility snapshot with element refs instead of a page dump, so it costs few tokens. Pinned to `@playwright/cli@0.1.24`, checked on Windows 2026-11-16: open, snapshot, resize, screenshot and close all worked with no separate browser download.

## Commands

Name your session after yourself so parallel agents don't share a browser, and run from the project root.

```bash
P="npx -y @playwright/cli@0.1.24 -s=fe-<feature>"   # qa: -s=qa-<feature>
$P open http://localhost:5173/route      # starts a headless browser
$P snapshot                              # roles, names, refs (e5, e12…) — read this, not screenshots
$P find "Save"                           # search the snapshot instead of reading all of it
$P fill e5 "user@example.com" --submit   # act on refs from the snapshot
$P click e12
$P press Tab                             # keyboard path: repeat, then snapshot to see focus
$P resize 360 800                        # mobile width; 1280 800 for desktop
$P console error                         # errors only
$P requests                              # failed or unexpected calls
$P screenshot --filename=.playwright-cli/<name>.png   # only when the look itself is the question
$P close                                 # always, before the report
```

`$P --help` and `$P <command> --help` list the rest (dialogs, uploads, storage state, request mocking, tracing, video).

## What to check

1. Each AC's flow end to end with real clicks and typing, at 360 px and 1280 px.
2. Keyboard only: every action reachable with Tab/Enter/Space/Esc, focus visible, and focus returns to the trigger after a dialog closes.
3. The states: empty, loading, error with retry (mock or stop the API), success — snapshot each.
4. `console error` empty apart from known noise, and no failed `requests` the feature caused.

Report what you checked under "Browser" with the widths and any console errors quoted.

## Traps (hit on the first run)

| Trap | Fix |
|---|---|
| `file://` URLs are blocked | Serve the page: the dev server, or `python -m http.server <port> --bind 127.0.0.1` for a static build. Stop the server you started (its PID), nothing else |
| Snapshots, logs and screenshots land in `.playwright-cli/` in the current folder | Make sure `.playwright-cli/` is in `.gitignore`; never commit it |
| A missing `favicon.ico` shows as a console error | Not an app error; ignore that one line |
| A headless session lingers for an hour after the last command | `close` your own named session at the end. Never `close-all` or `kill-all`: they also end other agents' and the user's browsers |
| No browser on a fresh machine | The CLI says so on `open`; report `Status: blocked: env browser` with the message rather than installing system software yourself |
| Clicking by visible text guesses wrong when labels repeat | Take refs from a fresh `snapshot` after every navigation; refs change when the page changes |

A login-protected page: sign in once with the project's seeded test account, then `$P state-save .playwright-cli/auth.json` and `state-load` it next time. Never type real credentials.
