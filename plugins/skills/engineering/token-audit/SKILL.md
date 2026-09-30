---
name: token-audit
description: Audits the token usage and failures of a single Claude Code workflow from the session transcript — tokens and estimated cost per agent, the biggest gaps (large files read whole, long command output, long exploration, cache misses, narration, long reports, fix rounds), agent failures (blocked/missing status, blocking findings per category, failing tests/builds, findings that came back), recurring failure patterns across workflows, and suggested fixes per agent file. Invoked automatically at the end of a Medium/Large ship-feature. Also use when the user says "token audit", "how many tokens did that use", "why is this so expensive", "which agent costs the most", or invokes /token-audit.
argument-hint: "[--workflow NAME | --all | --since ISO-TIME | --transcript PATH | --compare]"
---

# Token & Failure Audit

Run the script in this skill's folder (see "Base directory for this skill" above):

```bash
python3 "<base directory of this skill>/scripts/token_audit.py" $ARGUMENTS
```

No `python3` (common on Windows) → use `python` with the same arguments.

With no arguments, the script audits the **last `ship-feature` workflow** in this project's most recent session. Other options:

| Argument | Scope |
|---|---|
| `--workflow <skill-name>` | The last workflow started by that skill |
| `--all` | The whole session |
| `--since 2026-09-23T10:00:00Z` | Since a given time (UTC) |
| `--transcript <path.jsonl>` | A specific transcript |
| `--compare` | Average cost, fix rounds, re-verifications, blocking findings, and returned reports per engineer model, across every recorded workflow. Doesn't read a transcript |

## Rules

- **Show the script's output as-is.** Don't re-summarise it, don't recompute it, don't add tables of your own. Token counts come from the API `usage` in the transcript (exact). Tool-result sizes and $ impact are estimates.
- After the output, add **2 sentences max**, and only if something isn't visible from the numbers. For example: the gap was caused by a genuinely large user request, not by a wasteful agent.
- **Suggestions must be general, not project-specific.** These agents are used across many projects, so what gets fixed is how the agent works (the rules in `plugins/agents/*.md` or a pattern skill), not one project's error. Project-specific lessons are already stored in the engineer's memory during Fix mode. The `↳` lines are only evidence of the cause.
- A failure with an **environmental** cause (DB down, missing command, network) is not the agent's fault. Its suggestion is aimed at the project's `CLAUDE.md`, not at an agent file.
- **Don't modify agent files automatically.** Offer to apply the highest-impact suggestions to the user.
- The script fails or no transcript is found → report the error message in one line, then move on. The audit must never block the workflow.

## How to read the results

- **% of cost per agent** shows which agent is most worth optimising.
- **Gaps** are sorted by estimated impact. Content that enters the context earlier is re-read from cache on every later turn, so one large file at the start can cost more than many small files at the end.
- **Failures & findings** are read from the agent report format: the engineer's `Status:`, the verifier's `Decision:`/`Recommendation:`, the `CR-n`/`QA-BUG-n`/`SEC-n` finding lines, tests/builds that failed inside the agent, engineers re-invoked after `done` without "Fix mode", and blocking findings that reappear after being fixed. An agent that didn't follow the report format shows up as "⚠ no Status/decision line"; a run that hit `maxTurns` shows up as "⚠ stopped at maxTurns" and feeds the "Nearly out of turns" signal.
- **Background agents & continued runs**: a background agent's report is read from `<task-notification>`, because its tool_result is only "Async agent launched". A run continued via `SendMessage` counts as a call, labelled `(continued)`, `(continued-maxTurns)`, `(next slice)`, `(fix)`, or `(returned)`. Only `(returned)` counts as a returned report. Only fix runs and re-verifications count towards "Invoked repeatedly", and `maxTurns` is checked per run.
- **Finding categories** (aggregate-authz, state-update, css-cascade, existing-tests, null/no-op, loop/corrupt-data, authorization/IDOR, validation, contract, etc.) are guessed from keyword prefixes, with no severity labels, so the result is rough. Anything unmatched lands in "other".
- **Evidence (`↳`)**: one line of raw data per item, 2 max. For tests/builds: the decisive error line along with its cause (compilation/type, failing test, lint, environment). For recurring patterns: the original finding along with the project name.
- **Recurring failure patterns** appear when the same blocking category for the same engineer occurs in ≥2 of the last 5 workflows. If it happens across several projects, that's the strongest sign the weakness is in the agent. Suggestions from these patterns are always shown at the top.
- A test that fails once mid-iteration is normal. A per-cause suggestion only appears if the cause recurs, ends red, or comes from the environment.
- **Trends** appear once there are at least 2 previous runs. The logs live in `~/.claude/doz-agent/token-audit.csv` (tokens), `findings.csv` (findings), and `runs.csv` (per-workflow summary, used by `--compare`).
- $ figures are API list prices. Pro/Max subscriptions are not billed per token, so the $ figures only serve to compare agents. The prices live in `PRICES` inside the script.
- A `*` in a column means the subagent's transcript wasn't found. Its numbers come from the Agent result summary, with no gap analysis.
