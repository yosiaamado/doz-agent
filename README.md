# doz-agent

A personal collection of Claude Code subagents + skills. Upload it to GitHub once, then install it into any project with 2 commands.

## Contents

**Subagents** (`plugins/agents/`)

| Agent | Role | Can edit files? |
|---|---|---|
| `product-owner` | **Single pass:** impact analysis, scope, INVEST user stories + acceptance criteria, decisions + defaults, the agent plan, and accepting/rejecting the result | ❌ read-only |
| `system-analyst` | API contract, data model, BE/FE file map in one spec file (`docs/specs/<slug>.md`). **Optional** — only for large designs (≥3 endpoints, migrations, complex domains) | 📝 spec file only |
| `qa-tester` | Risk-based test strategy, test design techniques (BVA, decision tables), bug reports with severity + priority | ✅ |
| `security-tester` | STRIDE threat model + OWASP Top 10:2025 / ASVS 5.0 audit | ❌ read-only |
| `code-reviewer` | Review in the style of Google eng practices, comments labelled blocking/non-blocking | ❌ read-only |
| `backend-engineer` | APIs, services, DB, migrations, queues: requirement → design → code + tests → verification. 🧠 keeps a memory of the code-flow map | ✅ |
| `frontend-engineer` | UI, components, state, forms, WCAG 2.2 AA, Core Web Vitals. 🎨 has design taste (`ui-design-taste`), 🧠 keeps a memory of the component map | ✅ |
| `devops-engineer` | Docker, CI/CD, deploy, IaC, observability, SLOs, with production safety rules | ✅ |

**Skills** (`plugins/skills/<area>/<name>/SKILL.md`)

Skills are grouped by area. The area folder name doesn't affect how they're invoked: a skill is still called as `doz-agent:<name>`.

| Skill | Area | Contents |
|---|---|---|
| `ship-feature` | engineering | **The main entry point.** A one-command orchestrator: size the work (small/medium/large), run only the agents needed (PO → SA → BE ∥ FE → parallel verification → acceptance), the fix loop, stopping only for business decisions |
| `token-audit` | engineering | Token & failure audit of one workflow from the transcript: tokens & estimated cost per agent, the biggest gaps (large files read whole, long output, exploration, cache misses, narration, long reports), agent failures & blocking findings per category, failure patterns recurring across workflows, and suggestions per agent file. Automatic at the end of a Medium/Large `ship-feature`; manually: `/doz-agent:token-audit [--all]` |
| `run-workflow` | engineering | Runs a stored workflow (`plugins/workflows/<name>.md`, created in doz studio or by hand) step by step: parallelism, conditions, fix loops, approvals. Progress is written to `.doz-studio/runs/` so it shows live in studio. `/doz-agent:run-workflow <name> <request>` |
| `product-ownership` | product | The PO framework (Scrum Guide 2020): impact analysis, INVEST, Given/When/Then, story splitting, DoR, choosing agents, accepting the work |
| `engineering-workflow` | engineering | Team workflow: DoR/DoD, branching, Conventional Commits, PRs, code review, ADRs, SemVer, incidents & postmortems |
| `backend-patterns` | engineering | Backend base rules (REST, RFC 9457, zero-downtime migrations, OWASP, resiliency, OpenTelemetry) + per-language rules in `references/` (.NET, etc.) |
| `frontend-patterns` | engineering | Structure, state, forms, WCAG 2.2 AA, Core Web Vitals, CSP, the testing trophy |
| `devops-patterns` | engineering | Docker, CI/CD + supply chain, deploy & rollback, K8s, Terraform, SLOs & alerts, backup/DR |
| `analytical-thinking` | thinking | MECE, hypotheses, root cause, Fermi estimation, decision matrices, pre-mortems |
| `business-thinking` | product | Idea validation, PRDs, RICE/WSJF, unit economics, pricing, OKRs, A/B tests, build vs buy, UU PDP |
| `ui-design-taste` | design | Visual taste: hierarchy from space, the 4/8 scale, one accent, KPI/chart/table anatomy, states, motion, template anti-patterns + case studies in `references/` |
| `rab-kontraktor-advisor` | consultant | Product context for an RAB generator for small contractors: the AHSP/HSPK/SNI standards, BOQ/AACE, and the data & UX patterns of estimating software |

## Structure

```
doz-agent/
├── .claude-plugin/marketplace.json
├── CHANGELOG.md                 # version history: the reason + one line per change per file
├── agent-usage/                 # token-audit results per date, for comparing versions (not installed)
├── tests/                       # token-audit script tests: python3 -m unittest discover -s tests
├── studio/                      # doz studio: visual editor + workflow runner (not installed)
└── plugins/
    ├── .claude-plugin/plugin.json
    ├── agents/                  # 8 subagents (flat files, no subfolders)
    ├── workflows/               # stored workflows (.md): a graph of nodes + edges, read by studio & run-workflow
    ├── actions/                 # stored shell commands for action nodes (tests, checking changes)
    └── skills/
        ├── engineering/         # backend/frontend/devops-patterns, engineering-workflow, ship-feature, token-audit, run-workflow
        ├── product/             # product-ownership, business-thinking
        ├── design/              # ui-design-taste
        ├── thinking/            # analytical-thinking
        └── consultant/          # rab-kontraktor-advisor (domain skills per product/client)
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

## Visual workflows (doz studio)

`ship-feature` picks agents dynamically. For a **fixed** flow, or one you design yourself (e.g. "PO → BE → QA, retry BE up to 2x if QA fails", or "review ∥ security → you decide"), draw it in **doz studio**:

```bash
cd studio && npm install && npm run build
npm start -- --workdir /path/to/project     # http://localhost:4317
```

- An n8n-style interface with a dark/light theme: a left menu that expands on hover (agents/skills/actions, and you can create and edit their files right there), a canvas with a snap grid, a Logs panel at the bottom, and a Claude Code usage widget (the 5-hour & weekly limits).
- A **Setup** wizard on first open: check & test the Claude Code login (`claude -p`), the API key, git, and GitHub access.
- A **GitHub** button in studio: pull, commit, and push the doz-agent repo or the active project without opening a terminal.
- Ready-made templates: `fitur-kecil`, `fitur-lengkap`, `perbaikan-bug`, `audit-keamanan`, `review-pr`, `rilis`. A run's request can include documents (md, docx, pdf, etc.).
- A box = agent / skill / action (shell command) / condition / approval / note / output. An edge = the flow of output. A back edge from a condition = a loop with a limit.
- Every node is configurable: the brain (`claude-cli` using the Claude Code login, or `api` using an API key), model, effort, read-only permission, which nodes it takes input from, max turns, timeout, retry, budget.
- While running, the active node and the edge leading into it turn blue; finished ones turn green. Click a node to see tokens, duration, execution history, the prompt, the output, the changed files + diff, and the `claude -p` command that was run.
- Saving = a `plugins/workflows/<name>.md` file. It can be run from Claude Code without studio too: `/doz-agent:run-workflow <name> <request>`, and the progress still shows in studio if studio happens to be open.

Details: [`studio/README.md`](studio/README.md), the file format: [`plugins/workflows/README.md`](plugins/workflows/README.md).

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

Engineers must **self-review** their own diff before reporting: existing tests affected, every AC traced to code (including the "clearing" variants such as setting to `null` — no path may silently no-op), loops over existing data that could be corrupt, basic security, and conformance to the contract. The report includes an **AC → test map**, which is passed to QA so QA tests the gaps instead of repeating existing tests. Its Verification line (build result + full suite) is passed to the reviewer and QA too, so a suite that's already green isn't rerun: the reviewer focuses on design and correctness, and QA only runs the new tests + the affected module.

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

1. **The file map in the brief.** Engineers may only touch the files listed there (+ 3 context files max). This is what cuts out exploring from scratch — the single biggest cost in the whole flow.
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

## Upload to GitHub

```bash
git init
git add .
git commit -m "init doz-agent"
git branch -M main
git remote add origin https://github.com/<username>/doz-agent.git
git push -u origin main
```

## Install in any project

Open Claude Code in the project folder, then run:

```
/plugin marketplace add <username>/doz-agent
/plugin install doz-agent@doz-agent
```

The marketplace only needs adding once per machine. If the repo is private, make sure `git` on that machine is logged in to GitHub.

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

- Agent: create `plugins/agents/<name>.md` (frontmatter: `name`, `description`, `tools`, `model`, `effort`, `maxTurns`, `color`, optionally `skills`, `memory`, `experimental.cacheTtl` — set `1h` only if the agent runs builds/tests that can take more than 5 minutes)
- Skill: create `plugins/skills/<area>/<name>/SKILL.md` (frontmatter: `name`, `description`, optionally `effort`, `model`, `argument-hint`). A new area just needs a new folder; the invocation name stays `doz-agent:<name>` because it comes from the `name` frontmatter, not from the path
- Backend rules for a new language (e.g. Go, Node): create `plugins/skills/engineering/backend-patterns/references/<language>.md`, then add its row to the "Per-language rules" table in `backend-patterns/SKILL.md`
- Bump `version` in `plugin.json`, write the entry in `CHANGELOG.md`, then push (the commit is tagged `vX.Y.Z`).

A tip: `description` is what determines when an agent/skill gets used automatically. Write specifically **when** it should be used, not just what it's called.

A skill's contents only need the team's decisions and the traps you've actually hit. General explanation (the definition of SOLID, a list of HTTP statuses, the Core Web Vitals thresholds) isn't needed: the model already knows, and irrelevant text tends to get applied in the wrong places.
