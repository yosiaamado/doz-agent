# doz-agent

A collection of Claude Code subagents + skills for engineering and business work. Install it into any project with 2 commands (see [Install](#install-in-any-project)).

## Contents

**Shortcuts** (`plugins/skills/important/`). The commands that run a team; ask "shortcut apa aja" in any session to get this list.

| Shortcut | Use it to | Calls |
|---|---|---|
| `/doz-agent:ship-feature` | Build a product, feature, upgrade or bugfix end to end | Product and engineering agents, as needed |
| `/doz-agent:director` | Get leadership's view on one big decision, and see where they split | `ceo`, `cfo`, plus `cto`, `coo`, `cmo`, `legal-counsel`, `hr-lead` as relevant |
| `/doz-agent:sales-team` | Handle a prospect, find leads, or deal with an existing client | `sales-director`, `cmo`, `customer-success-lead`, by situation |
| `/doz-agent:deal-check` | Get a go or no-go before sending a proposal or signing | `sales-director`, `cfo`, `legal-counsel`, plus `cto` for custom scope |
| `/doz-agent:weekly-review` | Review the week and set one focus for the next | `sales-director`, `coo` |
| `/doz-agent:update-company` | Record a new client, hire, product or money change in `company/profile.md` | None, it asks you questions |
| `/doz-agent:archive` | Tidy `company/`: move misplaced or old files, merge duplicates, rename; you approve first | None |
| `/doz-agent:setting` | See or change settings in `company-repo.json`: local or repo, repo, branch, auto-push | None |
| `/doz-agent:shortcuts` | See this list | None |

**Subagents** (`plugins/agents/`). The files are flat, so areas are shown here and by colour in Claude Code.

**Engineering & product**

| Agent | Role | Can edit files? |
|---|---|---|
| `technical-lead` | Breaks a goal into vertical-slice tasks per agent (owner, files, interfaces, tests, order, checkpoints), supervises an agent's approach or report, and answers how the agents and skills fit together | ❌ read-only |
| `product-owner` | **Single pass:** impact analysis, scope, INVEST user stories + acceptance criteria, decisions + defaults, the agent plan, and accepting/rejecting the result | ❌ read-only |
| `system-analyst` | API contract, data model, BE/FE file map in one spec file (`docs/specs/<slug>.md`). **Optional** — only for large designs (≥3 endpoints, migrations, complex domains) | 📝 spec file only |
| `qa-tester` | Risk-based test strategy, test design techniques (BVA, decision tables), bug reports with severity + priority | ✅ |
| `security-tester` | STRIDE threat model + OWASP Top 10:2025 / ASVS 5.0 audit | ❌ read-only |
| `code-reviewer` | Review in the style of Google eng practices, comments labelled blocking/non-blocking | ❌ read-only |
| `backend-engineer` | APIs, services, DB, migrations, queues: requirement → design → code + tests → verification. 🧠 keeps a memory of the code-flow map | ✅ |
| `frontend-engineer` | UI, components, state, forms, WCAG 2.2 AA, Core Web Vitals. 🎨 has design taste (`fe-base`), 🧠 keeps a memory of the component map | ✅ |
| `devops-engineer` | Docker, CI/CD, deploy, IaC, observability, SLOs, with production safety rules | ✅ |
| `demo-video` | Narrated, cursor-driven demo videos and retina stills of a web app (pinned build, mocked requests) or a public URL, one scene at a time with a review stop; all local, voice included | ✅ demo workspace only |

**Leadership**

| Agent | Role | Can edit files? |
|---|---|---|
| `ceo` | Focus and what to stop, strategy, capital, investors, bet-the-company calls | ❌ read-only |
| `cfo` | Cash and runway, margins, pricing maths, scenarios, term sheets; computes rather than estimates | ❌ read-only |
| `cto` | Build vs buy, rewrites, tech debt as a business decision, team shape, AI adoption, technical risk | ❌ read-only |
| `coo` | Execution: the current constraint, lightest process, KPIs, cadence, vendors, delivery capacity | ❌ read-only |

**Sales & marketing**

| Agent | Role | Can edit files? |
|---|---|---|
| `sales-director` | Discussing a new prospect or open deal: rating, real buyer, next move, objections, discounts, tenders, forecast | 📝 `company/sales/` only |
| `cmo` | Positioning, ICP, go-to-market, channels on a small budget, what to measure, when not to spend | ❌ read-only |
| `customer-success-lead` | Onboarding, churn diagnosis, renewals, expansion, escalations, letting a customer go | ❌ read-only |

**People & legal**

| Agent | Role | Can edit files? |
|---|---|---|
| `hr-lead` | Hiring, pay, employee vs contractor, performance, exits, Indonesian labour rules | ❌ read-only |
| `legal-counsel` | Contract issue-spotting with proposed wording, IP ownership, UU PDP, PT matters, when to hire an advocate. Not legal advice | ❌ read-only |

**Markets**

| Agent | Role | Can edit files? |
|---|---|---|
| `trading-analyst` | Stocks (IDX/US), crypto, forex, commodities: macro, politics and geopolitics scorecard (13 factors, checked against measured correlation) → dated news from ≥ 2 outlets → sentiment vs expectations → "priced in?" in ATR multiples → chart vs index and peers → entry/stop/targets, R:R ≥ 2 and lot sizing, or a clear no-trade. Modes: analyze, review a position, scan a watchlist. Analysis only, never places orders | 📝 `trading-journal/` only |

The role agents give a position with reasons, a rejected option and next steps, labelling what is sourced, judged or unverified. They read `company/profile.md` in the working directory; when it's missing, their report tells the main thread to create it from the template and add `company/` to `.gitignore`, so it stays private. To share one company record across projects and machines, keep `company/` in its own private repo: run `/doz-agent:update-company`, pick **Repo** and give `owner/repo`: it writes `company-repo.json` (gitignored) and clones it right away, and from then on the plugin hook pulls it at session start and pushes changes after each turn. A guard hook asks you before any command deletes or moves a file in `company/`; agents can still add and edit. Setup: [`company-repo.md`](plugins/skills/business/company-roles/references/company-repo.md). Put company documents in `company/<division>/` (`leadership`, `finance`, `sales`, `marketing`, `customers`, `people`, `legal`, `tech`): each role reads its own folder when the question could use it. They can't call each other: ask for several at once ("what would the CEO, CFO and sales director say?") and the main thread runs them in parallel and shows where they disagree. To keep talking with one role, start a session with it: `claude --agent doz-agent:sales-director`.

**Skills** (`plugins/skills/<area>/<name>/SKILL.md`)

Skills are grouped by area. The area folder name doesn't affect how they're invoked: a skill is still called as `doz-agent:<name>`.

Renamed in 3.0.0 (old names no longer load): `ui-design-taste` → `fe-base`, `apple-design` → `fe-native-feel`, `dashboard-craft` → `fe-dashboard`, `scroll-craft` → `fe-scroll`, `video-demo` → `demo-video` (skill and agent). Each skill still credits its source repo and keeps that repo's license in `references/`.

| Skill | Area | Contents |
|---|---|---|
| `ship-feature` | important | **The main entry point.** A one-command orchestrator: size the work (small/medium/large), run only the agents needed (PO → SA → BE ∥ FE → parallel verification → acceptance), the fix loop, stopping only for business decisions |
| `token-audit` | engineering | Token & failure audit of one workflow from the transcript: tokens & estimated cost per agent, the biggest gaps (large files read whole, long output, exploration, cache misses, narration, long reports), agent failures & blocking findings per category, failure patterns recurring across workflows, and suggestions per agent file. Automatic at the end of a Medium/Large `ship-feature`; manually: `/doz-agent:token-audit [--all]` |
| `run-workflow` | engineering | Runs a stored workflow (`plugins/workflows/<name>.md`) step by step: parallelism, conditions, fix loops, approvals. `/doz-agent:run-workflow <name> <request>` |
| `product-ownership` | product | The PO framework (Scrum Guide 2020): impact analysis, INVEST, Given/When/Then, story splitting, DoR, choosing agents, accepting the work |
| `engineering-workflow` | engineering | Team workflow: DoR/DoD, branching, Conventional Commits, PRs, code review, ADRs, SemVer, incidents & postmortems |
| `backend-patterns` | engineering | Backend base rules (REST, RFC 9457, zero-downtime migrations, OWASP, resiliency, OpenTelemetry) + per-language rules in `references/` (.NET, etc.) |
| `frontend-patterns` | engineering | Structure, state, forms, WCAG 2.2 AA, Core Web Vitals, CSP, the testing trophy |
| `devops-patterns` | engineering | Docker, CI/CD + supply chain, deploy & rollback, K8s, Terraform, SLOs & alerts, backup/DR |
| `analytical-thinking` | thinking | MECE, hypotheses, root cause, Fermi estimation, decision matrices, pre-mortems |
| `business-thinking` | product | Idea validation, PRDs, RICE/WSJF, unit economics, pricing, OKRs, A/B tests, build vs buy, UU PDP |
| `fe-base` | design | Visual taste: hierarchy from space, the 4/8 scale, one accent, KPI/chart/table anatomy, bordered vs gapped surfaces, one hero surface, states, motion choreography (still chrome, reading-order entrances, fast exits, theme reveal), template anti-patterns + case studies in `references/`, a UX audit pass, and a bundled offline database (palettes, font pairings, styles, per-stack notes) for new products |
| `fe-native-feel` | design | Apple-grade feel for web, desktop and mobile apps: pointer-down feedback, 1:1 drags, interruptible springs, velocity handoff, momentum projection, rubber-banding, glass on floating chrome only, type tracking, platform conventions, Apple Pay on the web, and an HIG review method. Loaded by `frontend-engineer` only for interactive or native-feeling UI |
| `fe-dashboard` | design | Dashboards that feel premium: persistent shell (floating rail or sliding pill nav), bento grid with one hero card, spotlight-bar/spline/gauge/ring chart patterns, first-load choreography (shell → surfaces → blur-in text → count-up → chart draw), route change, circular dark-mode reveal, live-data tweening, traps, and Motion recipes in `references/`. Loaded by `frontend-engineer` for dashboard and analytics screens |
| `fe-scroll` | design | Scroll-driven, cinematic landing pages: brief + feeling curve with one peak, page grammars, fingerprint gate against earlier builds, a device per beat, dimensional layered heroes, the bundled scroll engine, scrub-ready encoding, and screenshot verification at every scroll position. Loaded by `frontend-engineer` for experience-style marketing pages |
| `demo-video` | media | The filming engine and workflow behind the `demo-video` agent: Playwright recorder, camera/cursor actor, local Kokoro voice, stitching, troubleshooting |
| `trading-analysis` | markets | The trader's routine behind `trading-analyst`: scope defaults, macro/politics/geopolitics factors with an IDX sector map, catalyst search, sentiment rubric (direction × materiality × surprise × source tier), priced-in table, plan recipe, journal loop, and `scripts/price_check.py` (MA/RSI/ATR/RS/beta plus correlation to macro proxies, from Yahoo daily data, stdlib only). Tested price/macro/news sources and IDX lot/tick rules in dated references |
| `company-roles` | business | The shared advisor method (position first, evidence labels, hand-offs, report template) and a sourced playbook per role in `references/`: what a senior owns, first questions, decision frameworks, benchmarks, Indonesian rules, traps |
| `archive` | important | Proposes a cleanup of `company/` (wrong folder, closed or old items to `company/_archive/`, duplicates, names), applies it after approval. `/doz-agent:archive` |
| `setting` | important | Shows and changes `company-repo.json` (local or repo, repo, branch, auto-push) and runs the git steps each change needs. `/doz-agent:setting` |
| `update-company` | important | Updates the private `company/profile.md` by asking what changed (client, team, product, money, goals, legal) with options from your own profile, and keeps a history. `/doz-agent:update-company` |
| `director`, `sales-team`, `deal-check`, `weekly-review`, `shortcuts` | important | Team shortcuts in the table above: they run in the main thread, call only the relevant role agents in parallel with the same brief, and show verdicts and disagreements. `shortcuts` answers which command does what |
| `rab-kontraktor-advisor` | consultant | Product context for an RAB generator for small contractors: the AHSP/HSPK/SNI standards, BOQ/AACE, and the data & UX patterns of estimating software |
| `finance-accounting` | consultant | Finance & accounting supervisor/PO for engineers: turns money features into specs (accounting treatment, debit/credit journals, rounding, golden test cases), with a research protocol for current Indonesian rules (PSAK, PPN, PPh, Coretax) and trusted formulas |

## Structure

```
doz-agent/
├── .claude-plugin/marketplace.json
├── CHANGELOG.md                 # version history: the reason + one line per change per file
├── agent-usage/                 # token-audit results per date, for comparing versions (not installed)
├── tests/                       # token-audit script tests: python3 -m unittest discover -s tests
└── plugins/
    ├── .claude-plugin/plugin.json
    ├── agents/                  # 20 subagents (flat files, no subfolders)
    ├── workflows/               # stored workflows (.md): a graph of nodes + edges, read by run-workflow
    ├── actions/                 # stored shell commands for action nodes (tests, checking changes)
    ├── hooks/                   # company-sync (repo sync), company-guard (asks before deleting or moving in company/)
    └── skills/
        ├── important/           # shortcuts: ship-feature, director, sales-team, deal-check, weekly-review, update-company, archive, setting, shortcuts
        ├── engineering/         # backend/frontend/devops-patterns, engineering-workflow, token-audit, run-workflow
        ├── business/            # company-roles (role playbooks)
        ├── product/             # product-ownership, business-thinking
        ├── design/              # fe-base, fe-native-feel, fe-dashboard, fe-scroll
        ├── media/               # demo-video
        ├── markets/             # trading-analysis
        ├── thinking/            # analytical-thinking
        └── consultant/          # rab-kontraktor-advisor, finance-accounting (domain skills per product/client)
```

## The feature workflow

One command is enough, or just write it out plainly — "build feature X all the way to done":

```
/doz-agent:ship-feature add a wishlist feature to catalog-web
```

| Size | Flow |
|---|---|
| Small | Done directly, no agents |
| Medium | API contract (if FE + BE) → backend ∥ frontend → review ∥ QA |
| Large | product-owner → API contract → backend ∥ frontend → review ∥ QA ∥ security → product-owner (acceptance) |

**The API contract** is written to `docs/specs/<slug>.md` so BE and FE never have to read each other's code. Who writes it depends on the size of the design:

| Condition | How |
|---|---|
| 1–2 endpoints, the API pattern is already clear | Written directly by the main thread (cheapest: no re-exploration) |
| ≥3 endpoints, a migration, or a complex domain | `system-analyst` |
| The response shape isn't settled, or the FE portion is small | No up-front contract: `backend-engineer` first, take the contract from its report, then `frontend-engineer` |

Want to discuss it first without implementing? Use `/doz-agent:product-ownership <idea>` (back and forth in the main chat), then continue with `ship-feature`.

## Stored workflows

`ship-feature` picks agents dynamically. For a **fixed** flow (e.g. "PO → BE → QA, retry BE up to 2x if QA fails", or "review ∥ security → you decide"), store it as a workflow file and run it:

```
/doz-agent:run-workflow fitur-kecil add CSV export to the orders page
```

Ready-made: `fitur-kecil`, `fitur-lengkap`, `perbaikan-bug`, `audit-keamanan`, `review-pr`, `rilis`. A node = agent / skill / action (shell command) / condition / approval / note / output; an edge = the flow of output; a back edge from a condition = a loop with a limit. File format: [`plugins/workflows/README.md`](plugins/workflows/README.md).

## Memory: agents that remember the code flow

`backend-engineer` and `frontend-engineer` use `memory: project`, so they keep a **per-project code-flow map** in `.claude/agent-memory/<agent>/` (committed to git, reviewable in a PR).

```
.claude/agent-memory/backend-engineer/
├── MEMORY.md     # thin router, 60 lines max: repo conventions + 1 line per module
└── orders.md     # detail per module, 15 lines max
```

**When it's written:** after build/tests are green, before writing the report — so what's stored is already proven correct, not a guess.

**When it's read:** `MEMORY.md` is loaded automatically by Claude Code at the start of every call (hence the 60-line cap). The module detail files are read first of all, before any exploration. The agent verifies a single anchor (grep one symbol name from the notes); if it doesn't match, the note is discarded, the search is redone, and the note updated. **The code always wins over memory.**

The contents are symbol names + paths + traps, **not line numbers** (which go stale fastest) and not code excerpts. Each note stores a commit SHA, so staleness can be checked with `git log --oneline <sha>..HEAD -- <path>`.

The first feature in a given area saves nothing — the gain starts from the second time you touch it.

**Learning from review:** when invoked in the fix loop, the engineer stores the **pattern** behind a reviewer/QA finding (not just the fix) — module-specific ones under `Traps`, general ones in the `Review lessons` section of `MEMORY.md` (10 lines max). The same mistake doesn't recur on the next feature.

## Measuring tokens

Every Medium/Large `ship-feature` closes with a **token audit**. The `token-audit` script reads the Claude Code transcript (`~/.claude/projects/...`), then shows:

- **Tokens per agent** from the API `usage` figures (exact) and their estimated cost (API list prices, for comparison only).
- **The biggest gaps, ordered by impact.** Content that enters the context is re-read from cache on every later turn, so a large file at the start counts all the way to the end.
- **Suggested fixes** pointing at the agent file that needs changing.
- **Failures & findings**, read from the agent report format: the engineer's status (`blocked`, or no status at all), the reviewer/QA/security decision, blocking findings per engineer and per category (existing-tests, null/no-op, loop/corrupt-data, authorization, etc.), tests/builds that failed inside the agent, reports sent back by the orchestrator, and findings that reappeared after being fixed.
- **Recurring failure patterns**: the same blocking category for the same engineer in ≥2 of the last 5 workflows, tracked across projects. Suggestions from these patterns are shown at the top, because cutting fix rounds usually saves more than trimming tokens.
- **Brief evidence**: every failure comes with one line of the cause from the raw data, e.g. a compilation error, the name of the failing test, or the original finding along with the project name.
- **Suggestions are always general**: what gets fixed is this plugin's agent working rules, not one project's error, so the agents stay usable for other projects. Failures caused by the environment (DB down, missing command) are directed at the project's `CLAUDE.md`.
- **Trends** against previous runs. The logs live in `~/.claude/doz-agent/token-audit.csv` (tokens), `findings.csv` (findings), and `runs.csv` (a per-workflow summary).
- **Engineer model comparison** via `/doz-agent:token-audit --compare`: average cost, fix rounds, re-verifications, and blocking findings per model.

Use this before changing an agent's prompt. Fix the biggest gap first, then compare the trend on the next run. An audit result that triggered a change is kept in `agent-usage/<date>.md` so it can be compared against the audit taken after the change.

## The agent report format

An agent's report enters the main thread's context in full and is resent on every turn, so the format is built like data, not prose:

- **The first line is the status/decision**: engineers use `Status: done | partial | blocked | needs-decision | too-big`, the reviewer uses `Decision:`, QA and security use `Recommendation:`. Every agent has a checkpoint at ~70% of `maxTurns`: stop taking on work and write the report, so it never stalls with nothing to show. The orchestrator decides the next step without reading the whole report.
- **One finding = one line** with an ID (`CR-1`, `QA-BUG-1`, `SEC-1`) and `path:line`. That line is copied verbatim into the fix batch, and the engineer replies per ID.
- **No narration between tool calls.** Reports to the orchestrator are terse; specs, memory, tests, commits, and security warnings stay in full sentences.

## Reducing review rounds

Engineers must **self-review** their own diff before reporting: existing tests affected, every AC traced to code (including the "clearing" variants such as setting to `null` — no path may silently no-op), loops over existing data that could be corrupt, basic security, and conformance to the contract. The report includes an **AC → test map**, which is passed to QA so QA tests the gaps instead of repeating existing tests. The spec also carries a **Review focus** list: up to 5 inputs or failure modes the requirement implies but no AC names (an "A or B" AC, a lookup from a paginated list, an aggregate endpoint that must respect the underlying permission, clearing a value), each pinned by a named test in the slice that owns it. Engineers map them in an **AC/RF → test map**, and the reviewer treats a Review focus item with no test as blocking. Its Verification line (build result + full suite) is passed to the reviewer and QA too, so a suite that's already green isn't rerun: the reviewer focuses on design and correctness, and QA only runs the new tests + the affected module.

## Saving tokens

**Model & effort:** the roles that determine the quality of the whole chain use Opus; execution roles use Sonnet.

| Agent | Model | Effort | maxTurns |
|---|---|---|---|
| `product-owner` | opus | high | 15 |
| `system-analyst` | opus | high | 25 |
| `code-reviewer` | opus | high | 25 |
| `security-tester` | opus | high | 30 |
| `backend-engineer`, `frontend-engineer` | sonnet | medium | 50 |
| `qa-tester`, `devops-engineer` | sonnet | medium | 40 |

The reasoning: a wrong API contract means rework for 2 agents — far more expensive than the difference between models. `maxTurns` stops an agent exploring endlessly, and every agent carries the rule **"stuck after ~15 searches → stop and report"**.

The orchestrator (`ship-feature`) runs at `high` effort, because in the default flow it writes the API contract itself.

**The engineer model experiment.** Opus is now only 2–2.5× the price of Sonnet per token, while fix rounds originate with the engineers. One round = the engineer plus every verifier running again. So what's being compared is the cost per finished feature, not the price per token:

```
/doz-agent:ship-feature --engineer-model opus add feature X
/doz-agent:token-audit --compare
```

Run 3–5 features of comparable size for each model (no flag = the model in the frontmatter, i.e. Sonnet). If Opus comes out cheaper per feature because it needs fewer rounds, switch `model: opus` in `backend-engineer.md` and `frontend-engineer.md`.

**What saves the most, largest first:**

1. **A brief that records decisions, not code.** Per slice: the files (with a pattern to follow), the exact interfaces, the spec's values, each test by name with its assertion, and the Review focus items. Engineers may only touch the listed files (+ 3 context files max). This is what cuts out exploring from scratch — the single biggest cost in the whole flow.
2. **The code-flow memory** in BE/FE, for areas already touched.
3. **Not invoking an agent for something the main thread can do.** `ship-feature` writes the contract itself for 1–2 endpoints, and handles Small changes with no agents at all.
4. **A single-pass PO.** 3 questions max, all with defaults, so there's never a second call.
5. **Engineers continued, not re-invoked.** After a `needs-decision`, a `blocked`, a partial report, a report sent back, or a finding that needs design understanding, `ship-feature` continues the same engineer via `SendMessage`, so its exploration isn't thrown away. Re-verification is still a new call with a narrow scope.
6. **Lean skills, loaded only as needed.** Engineers always carry their pattern skill (`skills:` loads the full contents), so it holds only default decisions and traps, not tutorials, plus a prohibition on adding those patterns to a project that doesn't use them. `references/dotnet.md` only when writing C#; `references/runtime.md` only when touching cache/queues/observability; verification agents load a pattern skill only when the diff touches that stack.
7. **Reports are capped** (engineers, QA, devops at 250 words).
8. **The 1-hour cache only on agents that run long builds/tests** (engineers, QA, devops). A 1-hour cache write is billed at 2× the input price (5 minutes: 1.25×), and only pays off when there's a 5–60 minute gap between requests, e.g. an engineer continued after verification. The other agents (PO, system-analyst, reviewer, security) use the 5-minute default, because within a single run the gap between requests is only seconds. `token-audit` flags any agent paying for a 1-hour TTL with no gap of ≥5 minutes.

**The user-side habits that matter most:**

1. **One feature, one session.** The entire chat is resent every turn, so a long session makes every step progressively more expensive. If it has to run long, use `/compact`.
2. **A `CLAUDE.md` in every working folder** (BE and FE separately). Run `/init` once in each.
3. **Split a large feature into vertical slices** that still deliver value.
4. **Skip product-owner when the requirement is already clear in your head.**
5. **Don't rerun the full chain for a small fix.** Only the agent that found the problem needs to re-check.

## Install in any project

Open Claude Code in the project folder, then run:

```
/plugin marketplace add yosiaamado/doz-agent
/plugin install doz-agent@doz-agent
```

The marketplace only needs adding once per machine.

## How to use it

**Skills** load automatically when the topic matches their `description`. They can also be invoked manually:

```
/doz-agent:backend-patterns
/doz-agent:business-thinking
```

**Agents** are invoked automatically when the context matches, except the verification agents (`code-reviewer`, `qa-tester`, `security-tester`): they are not invoked automatically after code changes, so a small change doesn't trigger expensive verification. Invoke them directly, or through `ship-feature`:

```
use the qa-tester agent to test the checkout feature
have security-tester audit the src/auth folder
@agent-doz-agent:code-reviewer review my changes
```

Every engineer agent automatically carries its own pattern skill. Each agent closes its report with a **Handoff** section suggesting the next agent (e.g. backend-engineer → qa-tester → security-tester → code-reviewer).

## Updating

Edit the files, then commit & push. On a machine that already has it installed, run:

```
/plugin marketplace update doz-agent
```

## Adding a new agent / skill

Full authoring rules (cost model, description style, size limits, phrasing that works, checklist) are in [`CLAUDE.md`](CLAUDE.md), which Claude Code loads automatically when working in this repo.

- Agent: create `plugins/agents/<name>.md` (frontmatter: `name`, `description`, `tools`, `model`, `effort`, `maxTurns`, `color`, optionally `skills`, `memory`, `experimental.cacheTtl` — set `1h` only if the agent runs builds/tests that can take more than 5 minutes)
- Skill: create `plugins/skills/<area>/<name>/SKILL.md` (frontmatter: `name`, `description`, optionally `effort`, `model`, `argument-hint`). A new area needs a new folder **and** an entry in the `skills` array of `plugins/.claude-plugin/plugin.json`; the invocation name stays `doz-agent:<name>` because it comes from the `name` frontmatter, not from the path
- Backend rules for a new language (e.g. Go, Node): create `plugins/skills/engineering/backend-patterns/references/<language>.md`, then add its row to the "Per-language rules" table in `backend-patterns/SKILL.md`
- Bump `version` in `plugin.json`, write the entry in `CHANGELOG.md`, then push (the commit is tagged `vX.Y.Z`).

A tip: `description` is what determines when an agent/skill gets used automatically. Write specifically **when** it should be used, not just what it's called.

A skill's contents only need the team's decisions and the traps you've actually hit. General explanation (the definition of SOLID, a list of HTTP statuses, the Core Web Vitals thresholds) isn't needed: the model already knows, and irrelevant text tends to get applied in the wrong places.
