---
name: run-workflow
description: Runs a doz-agent workflow stored as a file (plugins/workflows/<name>.md, created in doz studio or written by hand) step by step with subagents, including condition branches, fix loops, and approvals. Progress is written to .doz-studio/runs/ so it can be watched live in doz studio. Use when the user invokes /run-workflow, or says "run workflow <name>". Do not use for a feature with no stored workflow (that is ship-feature).
argument-hint: "<workflow-name> <request>"
---

# Run Workflow

You (the main thread) execute the workflow graph exactly as drawn. Don't add or skip steps.

**Arguments:** $ARGUMENTS

The first word = the workflow name, the rest = the request. No name → list the available workflows (excluding `README.md`) and ask. Empty request → use the start node's `input`, if it has one.

## 1. Find and read the file

Look for `<name>.md` in order in: `.claude/workflows/`, `plugins/workflows/` (both in the project), then `../../../workflows/` relative to this skill's base directory. Read it once.

The frontmatter holds `nodes`, `edges`, `defaults`, `budget_usd`. The body below the frontmatter is the **workflow notes**, which go into every agent prompt. Full specification: `README.md` in that same workflows folder. If there's an edge to a node that doesn't exist, or an edge leaving a condition/approval without `when`, stop and report it.

## 2. Progress log (for doz studio)

Create a run id `<YYYYMMDD-HHMMSS>-cc`. Each event is written as **one JSON line** to `.doz-studio/runs/<id>.jsonl` in the project root using Bash (`mkdir -p .doz-studio/runs` once, up front). Example:

```bash
echo '{"type":"node","run":"<id>","node":"be","status":"running","activity":"Implementing the export endpoint"}' >> .doz-studio/runs/<id>.jsonl
```

| When | Line |
|---|---|
| Start | `{"type":"run_start","run":"<id>","workflow":"<name>","source":"claude-code","input":"<short request>"}` |
| Node starts | `{"type":"node","run":"<id>","node":"<nodeId>","status":"running","activity":"<what is being done>"}` |
| Node finishes | `{"type":"node","run":"<id>","node":"<nodeId>","status":"done","summary":"<1 sentence>","verdict":true/false (if any)}` |
| Node skipped / failed / waiting | `status` `skipped` / `failed` (+ `"error"`) / `waiting` |
| Loop | `{"type":"loop","run":"<id>","edge":"<from>-><to>","count":<n>,"max":<max>}` |
| Finished | `{"type":"run_end","run":"<id>","status":"done"}` or `"failed"` + `"error"` |

Write an event for **every** node, including start, info, and skipped nodes, so every box in studio has a status. Text inside the JSON: one line, no single quotes, ~150 characters max. Several events may be combined in one Bash command. Don't write an agent's full output to the log.

## 3. Execution rules

- **Ordering.** A node is ready once every source of its incoming edges (except `loop` edges) has finished or been skipped. If none of its incoming edges is active, the node is **skipped**. Nodes that become ready at the same time (e.g. two agents after start) are invoked **in parallel, in one message**, up to `parallel` (default 3).
- **start**: output = the request. **info**: its text becomes context for the nodes it connects to.
- **agent**: invoke the `Agent` tool with `subagent_type: doz-agent:<agent>`. Build the prompt from the following sections, in this order:
  1. `# Workflow: <name>` + the workflow notes
  2. `## Request`
  3. `## Additional context` (connected info nodes)
  4. `## Results of previous steps`. Its contents are set by `inputs`: `previous` (default) = directly connected nodes, `all` = every preceding node, `none` = empty. Each output is truncated to `max_output_chars` (default 12000).
  5. `## Feedback (attempt n)` if this node is being repeated via a loop
  6. `## Your task in this step` = `instructions`, or "Do what your role calls for".
  7. `verdict: true` → append: "End your answer with a separate line reading exactly `VERDICT: PASS` or `VERDICT: FAIL`."
- **Node settings** (the node wins over `defaults`): `model` → the `model` parameter of the `Agent` tool. `permission: read-only` → append "Do not modify any file" to the prompt. `retry` → invoke once more if the agent fails or returns no report. `runner`, `effort`, `max_turns`, `timeout_min`, `budget_usd` apply only in doz studio; here they are ignored.
- **skill**: run it via the `Skill` tool with the same prompt.
- **action**: run the node's `command` (or the `command` in `actions/<action>.md`, looked up in the project's `plugins/actions/` then `../../../actions/` relative to this skill) via Bash in the project root. Exit code 0 = PASS, anything else = FAIL. Its output becomes this step's result.
- **condition**: the source = the `source` node (default: the incoming node). Source is an action → use its exit code. Otherwise take the last `VERDICT:` line from the source's output. Present → use it. Absent → evaluate the `check` question yourself from that output, don't invoke an agent. Yes → follow the `when: true` edge, no → `when: false`.
- **loop**: an edge with `loop: N` repeats the target node and every node below it, with the source node's output as feedback. N times already and still failing → `run_end` failed, report to the user.
- **approval**: write status `waiting`, show a summary of the previous results + the `message`, then ask the user with `AskUserQuestion` (Approve / Reject). Approve → `when: true`, reject → `when: false`, and the reason for rejection carries into the next step.
- **output**: combine the results of the preceding agent/skill nodes into a final report.

## 4. Token economy

- Don't re-read the workflow or agent files. Don't paste an agent's full output to the user.
- Updates to the user: 1 line max per completed node. The full report comes once, at the end: status, a summary per node, the loop count, and anything needing a user decision.
