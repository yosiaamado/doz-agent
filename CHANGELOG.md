# Changelog

Every meaningful change to the `doz-agent` plugin is recorded here, newest version at the top. Versions follow `plugins/.claude-plugin/plugin.json` (SemVer).

Rules for humans and AI changing this repo:

- Each version = one entry: the reason/source, then one line per change per file. Its commit is tagged `vX.Y.Z`.
- Going back to an older version: `git checkout vX.Y.Z -- plugins/` (or `git revert <commit>`). Comparing: `git diff vX.Y.Z..HEAD -- plugins/`.
- A change triggered by a usage audit names the file in `agent-usage/`, so its impact can be compared against the next audit.
- History before 1.15.0: see `git log`.

## [2.2.0] - 2026-10-22

Source: a user request for a finance & accounting skill that researches what senior finance/accounting people do, searches the web for current rules and trusted formulas, and acts as a supervisor/product owner for engineers.

- `skills/consultant/finance-accounting/SKILL.md` (new): role as finance supervisor/PO for engineers; the questions each senior role asks; a 6-step workflow (business events → standards → journals → formulas & rounding → spec → acceptance); a research protocol with tiered trusted sources, two-source verification, effective-date checks and a `⚠ NEEDS VERIFICATION` fallback when no web tool is available; the finance spec template; a review checklist; red flags.
- `skills/consultant/finance-accounting/references/senior-roles.md` (new): controller, senior accountant, revenue, tax, FP&A, treasury, cost accounting and internal audit work mapped to system requirements.
- `skills/consultant/finance-accounting/references/indonesia-regulations.md` (new): dated snapshot (2026-10-22) with sources — SAK EP, PSAK renumbering, PSAK 118, PPN under PMK 131/2024, Coretax NSFP, PPh 21 TER, final MSME tax under PP 20/2026, 10-year retention — plus a list of topics not yet researched.
- `skills/consultant/finance-accounting/references/formulas.md` (new): TVM, PMT, NPV/IRR, depreciation, effective interest, leases, FX, break-even, variances, ratios, WACC and rounding, each with a worked example recomputed in Python `Decimal`.
- `skills/consultant/finance-accounting/references/ledger-design.md` (new): double-entry invariants, data model, money/date/period rules, subledgers, multi-currency, controls, reconciliation, retention and required tests.
- `agents/product-owner.md`: `WebSearch`/`WebFetch` added (3 searches + 2 fetches max, inside the existing budget); money features load `finance-accounting`, acceptance criteria use real numbers, and every rule a decision depends on is cited with source + access date or marked `⚠ NEEDS VERIFICATION`.
- `agents/system-analyst.md`: `WebSearch`/`WebFetch` added (4 searches + 3 fetches max); money features load `finance-accounting` (plus `ledger-design.md` when writing to a ledger), and the spec template gains an optional **Finance** section — journals, formulas & rounding, golden test cases, invariants. Never invent a rate or rounding rule.
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`: register the skill.

## [2.1.0] - 2026-10-21

Source: a user request — engineer agents were writing too many documentation comments.

- `skills/engineering/backend-patterns/SKILL.md` §10: a "Comments: few, and only for why" rule — none by default, no doc comments on internal members, no restating/narration/change history/banners/commented-out code, match the file's density.
- `skills/engineering/frontend-patterns/SKILL.md` §2: the same rule for components, hooks and props (no JSDoc on internals).
- `agents/backend-engineer.md`, `agents/frontend-engineer.md`: a "Comments" self-review item (count added comments, delete any that aren't a non-obvious why); "full sentences" no longer applies to code comments.
- `agents/devops-engineer.md`: config/pipeline comments are rare, one line, why only.
- `agents/qa-tester.md` step 5: the same rule for test code — no Arrange/Act/Assert labels, no comments restating assertions, no doc comments on tests or fixtures.
- `agents/code-reviewer.md`: excess comments flagged as non-blocking.

## [2.0.0] - 2026-09-30

Source: a user request to make the product sellable — two languages, a packaged desktop app, and a one-click update button. Major version because every agent and skill file switched from Indonesian to English, and the report markers the orchestrator matches on changed (`Keputusan:`/`Rekomendasi:` → `Decision:`/`Recommendation:`).

### Breaking

- `plugins/**` (36 files): all agent, skill, reference, workflow and action files translated to English. English is now the only maintained version. `name:` values, workflow node ids and workflow filenames are unchanged, so `/doz-agent:<name>` and `run-workflow <name>` keep working.
- `skills/engineering/token-audit/scripts/token_audit.py`: the verdict regex accepts `Decision`/`Recommendation` alongside the old Indonesian markers, and "Fix mode" alongside "mode perbaikan", so old and new transcripts both parse. Finding-category labels are English now, so rows in an existing `findings.csv` stop grouping with new ones for the recurring-pattern feature; it self-heals within 5 runs.
- Update manifest and `installed.json`: field `version` → `contentVersion`, and `minAppVersion` is now required. Manifests using the old shape are rejected.

### Studio: runtime & packaging

- `server/infra/runtimePaths.js` (new): resolves `plugins/` and `web/dist` in three modes — dev inside the repo, an extracted zip, and a packaged Electron app — with a `DOZ_PLUGIN_DIR` override and one-time seeding into app-data.
- `server/infra/configStore.js` (new): config moves to the OS app-data folder (`%APPDATA%/doz-studio`, `~/Library/Application Support/doz-studio`, `~/.config/doz-studio`) with a one-time migration from `studio/.local.json`; secrets are stripped from the legacy file once the copy is verified.
- `server/app.js`: `startServer()` is callable as a module, falls back across ports when 4317 is taken, and writes `runtime.json` with the port actually used.
- `electron/main.js` (new) + `electron-builder` config: Windows NSIS installer, `contextIsolation`/`sandbox` on, external links handed to the OS browser, single-instance lock. `plugins/` and `web/dist` ship as `extraResources`.
- `.github/workflows/desktop-build.yml` (new): verify job (i18n check, tests, `npm audit`) then a packaging matrix; actions pinned to full SHAs; the macOS slot is prepared but not built.

### Studio: two languages

- `web/src/i18n/` (new): own i18n layer, no new dependency. 613 keys per locale, English default and fallback, language chosen in the Setup wizard and Settings.
- Server-produced text moved to ~80 `code` + `params` pairs translated on the client, so `/api/setup`, runner chips, run/engine errors and API errors are language-neutral on the wire.
- `scripts/i18n-check.js` (new): fails on missing translations, mismatched placeholders, unpaired plural forms and hardcoded strings. Runs in CI.

### Studio: one-click updates

- `server/services/updateService.js` + `routes/updateRoutes.js` + `infra/update{Keys,Config}.js` (new): `/api/update/{status,check,apply,settings}`. Manifests are ed25519-signed and verified before a single byte is downloaded; per-file sha256; HTTPS enforced on the endpoint, `baseUrl`, every file URL and every redirect hop; path traversal, symlinks, hardlinks and Windows device names rejected; staging → backup → write → rollback, with `UPDATE_ROLLBACK_INCOMPLETE` keeping the backup when rollback fails.
- Fail-closed by design: `PUBLIC_KEYS` ships as a placeholder, so every manifest is rejected until the product owner fills in a real key. `tests/releaseKeys.test.js` fails a tag build while the placeholder is still there.
- `scripts/keygen.js` (new): generates the signing pair on the owner's machine, refuses to write the private key inside the repo, prints only the public key.
- App version (binary) and content version (plugins + web) are reported separately, and `minAppVersion` stops a content update from landing on an app too old to run it.
- `web/src/features/update/` + `hooks/useUpdate.js` (new): Updates button with a badge, release notes, the list of files the buyer edited with an overwrite choice, and a configurable endpoint in Settings.

### Security (audit: 0 critical, 0 high, 2 medium, 5 low — all fixed)

- `server/infra/apiKeyStore.js` (new) + `electron/main.js`: the Anthropic API key is encrypted with Electron `safeStorage` (DPAPI on Windows) and only the ciphertext is stored; without a codec it falls back to plain text with a warning in the log. The previous `mode: 0o600` comment claimed protection that does not exist on Windows.
- `server/lib/secretEnv.js` (new): the key studio injects is no longer passed to shell-action and git child processes; `claude -p` still receives it.
- `server/http/static.js`: CSP, `X-Content-Type-Options`, `Referrer-Policy`, an `isInsideDir` boundary check, and a fix for a malformed `decodeURIComponent` that returned 500.
- `DOZ_UPDATE_ALLOW_HTTP` now only applies under the test runner.

### Docs & packaging

- `README.md`, `CHANGELOG.md`, `studio/README.md`, `agent-usage/**`, `docs/desktop-install.md` translated to English.
- `LICENSE.md` (new): personal and commercial use by the purchaser, no redistribution or resale.
- `.gitignore`: `dist-electron/` and release zips.
- Tests: 179 passing, 2 pre-existing Windows path failures, 2 skipped.
- `plugin.json` and `studio/package.json`: version 2.0.0.

## [1.20.0] - 2026-09-28

Source: a user request for first-time setup (connecting a Claude account until `claude -p` works, testing the API key, testing the GitHub account, etc.) before studio is used.

### Studio

- `server/services/setupService.js` + `routes/setupRoutes.js` (new): checks for Node, git (+ filling in the global identity), Claude Code installed & logged in (`claude auth status`), the doz-agent plugin, the API key, the doz-agent repo & the project; real tests of `claude -p` (haiku), the Claude API (haiku, 16 tokens), and GitHub access (`git ls-remote`); triggers `claude auth login` (Claude account or Console); SDK error messages are translated (401/403/429/connection).
- The API key can be set for the session or remembered in `studio/.local.json` (gitignored); it's used automatically at startup; the API client is reset when the key changes (`runners/api.js`: `resetClient`, `testApiConnection`).
- `web/src/features/setup/` (new): a 5-step Setup wizard that opens automatically the first time and from the Setup button in the top bar (a yellow dot while incomplete); the Finish button activates once Node & git are fine and at least one AI brain passes its test.
- Tests: `test/setup.test.js`; 43 tests in total.
- `plugin.json`: version 1.20.0.

## [1.19.0] - 2026-09-28

Source: a user request to be able to push and pull to GitHub directly from Doz Studio.

### Studio

- `server/services/gitService.js` + `routes/gitRoutes.js` (new): status (branch, upstream, ahead/behind, changed files, last commit), fetch, pull (`--rebase --autostash`), commit all changes, push (creating the upstream if absent, never force). The target is `repo` (doz-agent) or `workdir` (the active project). Tokens in the remote URL and in git messages are masked. `GIT_TERMINAL_PROMPT=0` so the server never waits on a password.
- `web/src/features/dialogs/GitDialog.jsx` (new) + a GitHub button in the top bar with a badge for the number of changed files; push asks for confirmation via a modal; after a pull/commit in the doz-agent repo, the agent/skill/workflow lists are reloaded.
- Tests: `test/git.test.js` using a local bare remote (commit → push → pull in another clone, autostash, a branch with no upstream, token masking). 39 tests in total.
- `plugin.json`: version 1.19.0.

## [1.18.0] - 2026-09-28

Source: user feedback on the studio UI (16 points: snap grid, modern dropdowns, logo/favicon, hover menu, light/dark theme, document attachments, Claude Code usage, modals replacing alerts, a folder picker, etc.) and a request to apply the [everything-claude-code](https://github.com/worldflowai/everything-claude-code) patterns so the FE is modern and the BE readable/SOLID. The agent files did not change.

### Studio: backend (`studio/server/`)

- Split per layer: `app.js` (composition root), `http/` (router, localhost middleware, `{ success, data | error }` responses, zod schemas, static, socket), `routes/`, `services/`, `repositories/`, `domain/`, `runners/`, `infra/`, `lib/`.
- The engine is split into `graph.js` (pure functions), `executors.js` (per node type), `engine.js` (orchestration); run state is no longer mutated.
- Engine bug fix: a node that becomes ready after another node is skipped within the same pass is no longer missed (e.g. the "clean" path in the audit workflow).
- The `claude-cli` runner: the prompt goes via stdin, agent definitions via a temporary file (short arguments, safe on Windows `claude.cmd`), and it records `rate_limit_event`.
- New: document attachments (`/api/attachments`, md/txt/code/docx text is inlined, pdf/images go by path), Claude Code usage (`/api/usage`: the 5-hour & 7-day limits + local tokens from `~/.claude/projects`), a folder browser (`/api/folders`).
- A structured JSON logger, `ApiError` + a central error handler, and the API runner's `bash` tool using the same `shell.js`.
- Tests: 34 (unit, API integration, the runner with a fake `claude`, workflow templates), line coverage ~89%.

### Studio: frontend (`studio/web/`)

- Dark & light themes (following the system or set manually), colour tokens in `styles/tokens.css`.
- A new logo (a robot + a 4-step flow) in the menu and as the favicon.
- The left menu: an icon rail that expands on hover and narrows when you leave; Editor | Executions tabs inside the menu; drag-and-drop on a small screen; the "edit" tag removed.
- The canvas: snap to a 20px grid, pan with a left click, Shift+drag to multi-select.
- Custom dropdowns (Select/Combobox) and modals (confirm/prompt), fully keyboard-operable; the built-in `alert`/`confirm`/`prompt` removed.
- A file-manager-style folder picker for the project folder and source folders; the top bar no longer stacks on a small screen.
- The run dialog can attach documents; a Claude Code usage widget in the top bar; a New Workflow dialog built from templates.
- Titles use Title Case; a per-feature structure (`components/ui`, `features/*`, `hooks`, `lib`, `state`, `styles`), lazy-loaded dialogs, an ErrorBoundary.

### Plugin

- `plugins/workflows/`: new templates `perbaikan-bug`, `fitur-lengkap`, `audit-keamanan`, `rilis`.
- `plugin.json`: version 1.18.0.
- `.gitignore`: `studio/.usage.json`.

## [1.17.0] - 2026-09-28

Source: a user request for an n8n-style studio UI (dark grey, Figma-style canvas panning), active-blue/finished-green status carried through to the edges, managing agents/skills/actions from the UI, and per-node detail (tokens, duration, history, file diffs, the CLI command). The agent files did not change.

### Studio (`studio/`)

- The UI rewritten in the n8n style: a left palette (search, drag, `+` to create, a pencil to edit, source folders), Editor/Executions tabs, a dotted-grid canvas with Figma-style navigation, box nodes labelled below + wide agent nodes, resizable sticky notes, a floating Run button.
- Run status: a running node pulses blue with an animated blue edge, nodes/edges already passed turn green, unselected branches dim; live duration, live tokens, the execution count, and the file count below the node.
- The Logs panel: a node tree + per-node detail (Info + execution history, Input, Output, Files + a diff loaded on selection, a copyable CLI Command, Activity).
- The component editor: create/edit agents, skills, actions (Form mode changes frontmatter keys one at a time, Raw mode the whole file), showing which workflows use it.
- Source folders are configurable (`plugins/*`, `{workdir}/.claude/*`, `~/.claude/*`, etc.).
- A new `action` node: a shell command in the project folder, exit code 0 = PASS, read directly by a condition.
- Server: `library.js` (read/write components from several folders), `gitdiff.js` (a working-tree snapshot per node via a temporary index), `runners/shell.js`; the runner sends the command it displays, live tokens, and the files written; `claude -p` uses `--plugin-dir plugins`.

### Plugin

- `plugins/actions/` (new): `cek-perubahan.md`, `jalankan-test.md`.
- `plugins/workflows/README.md`: the `action` node, sticky note sizing, the stored-action format.
- `skills/engineering/run-workflow/SKILL.md`: running action nodes via Bash; conditions using an action's exit code.
- `plugin.json` & `marketplace.json`: version 1.17.0.

## [1.16.0] - 2026-09-28

Source: a user request for an n8n-style GUI (boxes + edges) so agent flows can be designed, configured, and watched live, with the brain coming from Claude Code or an API key. Flows are stored as separate workflow files; the agent files did not change.

### Workflows (`plugins/workflows/`, new)

- `README.md`: the format specification (start/agent/skill/condition/approval/info/output nodes, `when`/`loop` edges, node settings > defaults > agent > built-in, the `.doz-studio/runs/` progress log).
- `fitur-kecil.md`: an example PO → BE → QA with a fix loop capped at 2 rounds and an info node.
- `review-pr.md`: an example code review ∥ security review (read-only) → human approval.

### Skills (`plugins/skills/engineering/`)

- `run-workflow/SKILL.md` (new): runs a workflow file from Claude Code without studio (parallelism, conditions via VERDICT, loops, approvals via AskUserQuestion) and writes JSONL progress for studio.

### Studio (`studio/`, new, not installed)

- A local Node server (127.0.0.1): the graph engine (parallelism, branches, loops, approvals, retry, timeout, budget), the `claude-cli` runner (`claude -p --agents/--agent`, stream-json) and the `api` runner (the Claude API + local tools sandboxed to the workdir), JSONL run logs + a watcher for runs started from the terminal.
- A React Flow UI: an agent/skill/node palette, settings panels per node and per workflow, live status/activity/cost per box, a log & output panel, approval buttons.
- `npm test`: tests for the engine, validation, settings, CLI arguments, and the API tool sandbox.

### Other

- `README.md`: the Visual workflows section, the `run-workflow` skill, the `studio/` and `plugins/workflows/` structure.
- `plugin.json` & `marketplace.json`: version 1.16.0, 12 skills.
- `.gitignore`: `studio/node_modules`, `studio/web/dist`, `studio/.local.json`, `.doz-studio/`.

## [1.15.0] - 2026-09-25

Source: an audit of one large `ship-feature` workflow (8 requests, 4 slices, BE+FE, ≈ $41), see [`agent-usage/2026-09-25.md`](agent-usage/2026-09-25.md). The main problems: agents stopped at `maxTurns` with no report 6 times, an engineer was handed 4 slices at once without a `too-big`, continuations via SendMessage cost ~$13, and bugs slipped through self-review. Every change is general (not specific to one project). Agent frontmatter did not change.

### Agents (`plugins/agents/`)

- `backend-engineer.md`: a turn checkpoint at ~35 tool calls → a `Status: partial` report; a quantitative too-big check (>1 slice or >~15 non-test files); `blocked: env` and `blocked: cannot reproduce` under Verification; self-review: a new status column → grep every query on that entity, an AC with ≥2 conditions tested per condition, aggregate endpoints using the underlying resource's permission; a Status template + `partial`.
- `frontend-engineer.md`: a turn checkpoint at ~35 → `partial`; a quantitative too-big check; `blocked: env`/cannot reproduce; self-review: ACs with ≥2 conditions, map-shaped state merged, style overrides (inline style vs `:hover`), data by id fetched through the by-id endpoint; a Status template + `partial`.
- `devops-engineer.md`: a turn checkpoint at ~28 → `partial`; a Status template + `partial`.
- `product-owner.md`: the search budget tied to a checkpoint at ~10 tool calls.
- `system-analyst.md`: a turn checkpoint at ~17; the spec skeleton (headings + slices) written up front; the spec template gains a `Slices` section, `[S1]` tags in the file map, and file owners when there's >1 engineer per layer; an execution plan of one engineer call per slice.
- `code-reviewer.md`: a diff of >~25 files → logic files first; a turn checkpoint at ~17 → a report with `Not reviewed`.
- `security-tester.md`: a turn checkpoint at ~21 → a report with `Not reviewed`; A01 + aggregate endpoints; A08 + prototype pollution (user-controlled keys).
- `qa-tester.md`: a turn checkpoint at ~28; environment unavailable/cannot reproduce goes under `Not covered`; an AC with ≥2 conditions = one test per condition; `Recommendation` + `Cannot decide yet`.

### Skills (`plugins/skills/engineering/`)

- `ship-feature/SKILL.md`: step 1 asks the user to log in in the browser when there's a visual AC and browser tooling (no browser → "visual not checked"); the brief template gains `Slices` and slice tags in the file map; file owners when there's >1 engineer per layer; one engineer call = one slice, parallel only when the file maps don't overlap; a `partial` status is continued via SendMessage; a diff of >~25 files → code-reviewer split per layer/module.
- `frontend-patterns/SKILL.md` §9: object lookups with user-controlled keys use `Map`/`Set`/`Object.hasOwn`.
- `backend-patterns/SKILL.md`: §2 lower and upper bounds for every numeric query param (400) + an offset without overflow; §4 response DTOs containing only the fields consumers use.
- `backend-patterns/references/dotnet.md`: the `CreateAsync` example no longer calls `BeginTransactionAsync` directly (it conflicts with `EnableRetryOnFailure`); the manual-transaction rule via `CreateExecutionStrategy().ExecuteAsync`; pagination validating the `page` and `pageSize` bounds.
- `token-audit/SKILL.md`: falls back to `python` when `python3` is absent; documents the `(continued-maxTurns)`/`(next slice)` labels, the maxTurns status, and the new categories.

### The `token-audit/scripts/token_audit.py` script

- Output forced to UTF-8 (`reconfigure`), so it no longer crashes with `UnicodeEncodeError` on a cp1252 Windows console.
- The `Status:` regex recognises `partial`.
- A run that hit `maxTurns` (an "N-turn limit" notification, or a turn count at the limit with no Status/decision line) shows as "⚠ stopped at maxTurns", feeds the "Nearly out of turns" signal, and has its own suggestion.
- Continuation labels: after maxTurns → `(continued-maxTurns)`; after `done` with a prompt containing "slice" → `(next slice)`. Neither counts as a "report sent back".
- Finding categories: matched from the text without severity labels and at word boundaries (previously `"lock"` matched "blocking" and `"race"` matched "traceId", so many findings landed wrongly in transaction/concurrency). New categories `aggregate-authz`, `state-update`, `css-cascade` at the very top.
- `max_turns_of` closes the file it reads.

### Repo

- `plugins/.claude-plugin/plugin.json`: version 1.14.0 → 1.15.0.
- New: `CHANGELOG.md` (this file), `agent-usage/README.md` (the usage log format), `agent-usage/2026-09-25.md` (the audit that triggered this version).
- `README.md`: the repo structure + `CHANGELOG.md`, `agent-usage/`, `tests/`; the `partial` status and turn checkpoints under the agent report format; the release step of writing a changelog entry and a tag.

### Tests

- New: `tests/test_token_audit.py` (12 tests: categories, continuation labels, the maxTurns status, cp1252 output). Run with: `python3 -m unittest discover -s tests`.
