# Workflows

One `.md` file = one workflow. These files are the **source of truth**:
- **doz studio** (`studio/`) draws and edits them as boxes and lines, and can run them.
- The **`run-workflow`** skill runs them straight from Claude Code, without studio: `/doz-agent:run-workflow <name> <request>`.

Agent files (`plugins/agents/`) hold no flow. The agent is the box, the workflow is the wiring, so one agent can be used in many workflows.

## Format

```markdown
---
name: fitur-kecil
description: One sentence
defaults: { runner: claude-cli, inputs: previous }   # applies to every agent/skill node
budget_usd: 8          # optional: the run stops if cost exceeds this
parallel: 3            # optional: max parallel nodes
nodes:
  - { id: start, type: start, label: Request }
  - { id: be, type: agent, agent: backend-engineer, label: Implementation }
  - { id: qa, type: agent, agent: qa-tester, verdict: true }
  - { id: lolos, type: condition, source: qa, check: QA passed? }
  - { id: selesai, type: output }
edges:
  - { from: start, to: be }
  - { from: be, to: qa }
  - { from: qa, to: lolos }
  - { from: lolos, to: selesai, when: true }
  - { from: lolos, to: be, when: false, loop: 2 }
layout:                # box positions, used by studio only
  start: [ 0, 120 ]
---

Free-form notes. These are sent to every agent as workflow context.
```

### Node types

| type | Fields | Behavior |
|---|---|---|
| `start` | `input` (optional, defaults to the request) | The entry point. Output = the request at run time |
| `agent` | `agent` (required), `instructions`, `verdict` + settings | Runs the subagent `plugins/agents/<agent>.md` |
| `skill` | `skill` (e.g. `doz-agent:ship-feature`) + settings | Runs a skill. In studio, only the `claude-cli` runner |
| `action` | `command` and/or `action` (a name in `plugins/actions/`), `timeout_min` | A shell command in the project folder (test, lint, build). Exit code 0 = PASS, so it can wire straight into a condition |
| `condition` | `source`, `check`, `mode` (`auto`/`verdict`/`llm`), `model` | Picks a branch. First it uses the exit code (if `source` is an action) or the `VERDICT: PASS/FAIL` line in `source`'s output; failing that, an LLM judge (haiku by default) answers the `check` |
| `approval` | `message` | Halts until a human approves (`when: true`) or rejects (`when: false`) |
| `info` | `text` | A sticky note. Wired into a node, its text goes into that node's context. Its size is stored in `layout` (`[x, y, width, height]`) |
| `output` | - | Collects the output of every preceding agent/skill into a final report |

`label` can be set on any node. `verdict: true` asks the agent to close its answer with `VERDICT: PASS/FAIL`, so the condition doesn't need another LLM call.

### Edges

- `{ from, to }`: `from`'s output flows into `to`.
- An edge leaving a `condition`/`approval` must have `when: true|false`.
- `loop: N` marks a back edge: the target node and all its descendants are repeated with feedback, N times max. A cycle without `loop` is rejected.

### Settings (in `defaults` or on an agent/skill node)

Precedence: **node > workflow defaults > the agent's frontmatter > the built-in default**. An empty value or `inherit` is not written to the file.

| Key | Values | Default | Notes |
|---|---|---|---|
| `runner` | `claude-cli` / `api` | `claude-cli` | `claude-cli`: `claude -p` using the Claude Code login. `api`: the Claude API with `ANTHROPIC_API_KEY` and local tools (read/glob/grep/edit/write/bash/load_skill) |
| `model` | `opus`/`sonnet`/`haiku`/a model id | from the agent | |
| `effort` | `low`…`max` | from the agent | |
| `permission` | `read-only` | per the agent's tools | Drops Edit/Write. On the CLI, Bash is restricted to `git diff/log/status/show` and `ls`. On the API, bash is dropped |
| `inputs` | `previous`/`all`/`none` | `previous` | Which nodes' output goes into the prompt. The less, the cheaper in tokens |
| `max_output_chars` | number | 12000 | Preceding nodes' output is truncated here |
| `max_turns` | number | from the agent | |
| `timeout_min` | number | 30 | |
| `retry` | number | 0 | Retry on failure (error/timeout) |
| `budget_usd` | number | - | Cost limit per node |

In `run-workflow` (Claude Code without studio), only `model`, `permission` (as an instruction), `inputs`, `max_output_chars`, and `retry` apply. The rest apply in studio only.

## Stored actions (`plugins/actions/`)

Frequently used commands can be stored as files so they appear in studio's palette:

```markdown
---
name: jalankan-test
description: Run the project's test suite
command: npm test --silent
timeout_min: 15
---

Notes on when to use it.
```

An `action` node references it with `action: jalankan-test`. A `command` on the node overrides the file's command. Actions are read only by studio and `run-workflow`; plain Claude Code doesn't use them.

## Live progress

Studio and `run-workflow` both write events to `<project>/.doz-studio/runs/<id>.jsonl` (one JSON per line: `run_start`, `node`, `activity`, `loop`, `cost`, `run_end`). Studio watches this folder, so a run from the Claude Code terminal also shows up on the canvas. Add `.doz-studio/` to the project's `.gitignore`.
