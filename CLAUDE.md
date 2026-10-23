# doz-agent — rules for changing agents and skills

This repo is a Claude Code plugin. Agent and skill files are **code that shapes model behavior**, and every byte in them is paid for on every call. Read this before adding or editing anything under `plugins/`.

## Where the cost actually comes from

Measured in `agent-usage/2026-09-25.md`: engineers are ~70% of a run, and **cache reads (126M tokens) dwarf everything else**. Cost ≈ turns × resident context, so the levers, in order:

1. **Fewer turns** — a precise brief (exact files, interfaces, test assertions) beats any prompt trimming. Exploration from scratch is the biggest single cost.
2. **Smaller resident context** — a fresh agent per unit of work stays small; a long-continued agent re-reads its whole history every turn.
3. **Fewer fix rounds** — rounds come mostly from ambiguity in the brief, not from weak models.
4. Prompt length — real, but last. Ties still go to the shorter wording.

Turn count beats token price: a cheaper model that takes 2–3× the turns on multi-step work costs more. Don't move multi-step work to a smaller tier to save money.

## Repo facts

- **English only** inside `plugins/` (since 2.0.0). Chat with the user in their language.
- Skills: `plugins/skills/<area>/<name>/SKILL.md`. A **new area folder must also be added to the `skills` array in `plugins/.claude-plugin/plugin.json`**, or it never loads. The invocation name comes from frontmatter `name`, not the path.
- Agents stay **flat** in `plugins/agents/`. Subfolders there become part of the agent's name and break every reference.
- Every plugin change: bump `version` in `plugin.json` (SemVer), add a `CHANGELOG.md` entry (source/reason, then one line per file), update the README tables, commit as `type(scope): summary (X.Y.Z)`, lightweight tag `vX.Y.Z`.
- Validate: `claude plugin validate .` and `claude plugin validate plugins`. These check manifests only — also check frontmatter parses (an unquoted `: ` inside `description` breaks YAML).
- `studio/dist-electron/` and `*.zip` are build output. Never edit them.

## Writing a description (loaded into every session)

- Start with **"Use when…"** and list **triggers only**: situations, symptoms, words the user says. Add one "Don't use for X (that's `<other>`)" line when two agents could be confused.
- **Never summarize the workflow** in the description. Evidence from obra/superpowers: when a description says what the skill does step by step, the model follows the description and skips the body.
- Target ≤ 400 characters. All descriptions together are resident context in every session.

## Writing an agent

Frontmatter defaults:

| Field | Rule |
|---|---|
| `model` | `opus` for roles whose mistakes multiply downstream (PO, system analyst, reviewer, security). `sonnet` for execution. Never `haiku` for multi-step work |
| `effort` | `high` for judgment roles, `medium` for execution |
| `maxTurns` | Set it. Body must contain a **checkpoint at ~70%**: stop working and write the report |
| `tools` | Least privilege. Read-only roles get no `Edit`/`Write`. `WebSearch`/`WebFetch` only with a written search budget |
| `skills` | Preload only what the agent needs on **every** call. Everything else: load via the `Skill` tool at the step that needs it |
| `memory` | `project` only for agents that re-enter the same codebase areas (engineers) |
| `experimental.cacheTtl` | `1h` only for agents with 5–60 min gaps between requests (long builds/tests). Otherwise omit |

Body, in this order: role (2–3 lines) → working rules → budget (search cap, "stuck after ~15 searches → stop and report", turn checkpoint) → output style → steps → report template. Report rules:

- **First line is machine-readable status**: `Status:` (engineers), `Decision:` (reviewer), `Recommendation:` (QA/security). `token-audit` and the orchestrator parse these exact markers — don't rename them.
- One finding = one line with an ID and `path:line`. A word cap on the whole report.

## Writing a skill

- **`SKILL.md` must stay under 20,000 characters** — after compaction Claude Code re-attaches a skill truncated at that point, so anything past it silently disappears. Aim for ≤ 12,000.
- Put procedures used only at one step, long examples, and reference tables in `references/`, and point to them **at the step that needs them** ("read X when Y"), not in a list at the top.
- Content = the team's decisions and traps actually hit. No tutorials on things the model already knows (SOLID, HTTP status codes): irrelevant text gets applied in the wrong places.
- Facts that change (tax rates, standards, versions) live in a dated reference file with sources, plus an instruction to verify before use.

## Phrasing that measurably works

From superpowers' micro-tests (5 reps per phrasing):

- **For anything the model composes** (a brief, a plan, a report): give a **positive recipe** — "your brief contains: (1) … (5) …". A prohibition like "don't restate the spec" made it *worse* than no guidance. Don't add nuance clauses to a recipe that works.
- **Prohibitions are fine** for discrete actions with no competing incentive ("don't rerun the suite the engineer already ran") and for policy ("never push without permission").
- **Tripwires** on concrete tokens work ("if your report contains 'should work', stop and run it").
- **Recognition tables** (`| Excuse | Reality |`) work, because they're read at decision time.
- **Rules live where the reader acts**, not in a recap section at the end.

## Before changing tuned behavior

Sentences in agent bodies were tuned against real runs. Changing them needs evidence:

1. A real problem from a session (a `token-audit` finding, a bug that slipped, a stalled agent), not a theoretical one.
2. The smallest change that addresses it.
3. A before/after: rerun a comparable feature and compare `token-audit` output, or a `claude plugin eval` case. Record the result in the CHANGELOG entry and, for cost changes, in a new `agent-usage/` file.

## Checklist before commit

- [ ] English only inside `plugins/`
- [ ] Description starts with "Use when", triggers only, ≤ 400 chars, YAML-safe
- [ ] `SKILL.md` < 20,000 chars; one-step material moved to `references/`
- [ ] New area registered in `plugin.json` `skills`
- [ ] Agent has `maxTurns`, a ~70% checkpoint, a search cap, and a first-line status
- [ ] Status markers unchanged (or `token-audit` updated in the same commit)
- [ ] `python -m unittest tests.test_plugin_structure` passes (size, descriptions, layout, maxTurns)
- [ ] Version bumped, CHANGELOG + README updated, both validators pass
