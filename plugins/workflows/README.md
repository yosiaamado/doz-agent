# Workflows

One `.md` file = one workflow: a fixed graph of agent, skill and action steps. The **`run-workflow`** skill runs it from Claude Code: `/doz-agent:run-workflow <name> <request>`. Write or edit the file by hand, or ask Claude to.

Agent files (`plugins/agents/`) hold no flow. The agent is the box, the workflow is the wiring, so one agent can be used in many workflows.

## Format

```markdown
---
name: fitur-kecil
description: One sentence
defaults: { inputs: previous }   # applies to every agent/skill node
parallel: 3            # optional: max parallel nodes
nodes:
  - { id: start, type: start, label: Request }
  - { id: be, type: agent, agent: backend-engineer, label: Implementation }
  - { id: qa, type: agent, agent: qa-tester, verdict: true }
  - { id: lolos, type: condition, source: qa, check: "QA passed?" }
  - { id: selesai, type: output }
edges:
  - { from: start, to: be }
  - { from: be, to: qa }
  - { from: qa, to: lolos }
  - { from: lolos, to: selesai, when: true }
  - { from: lolos, to: be, when: false, loop: 2 }
---

Free-form notes. These are sent to every agent as workflow context.
```

### Node types

| type | Fields | Behavior |
|---|---|---|
| `start` | `input` (optional, defaults to the request) | The entry point. Output = the request at run time |
| `agent` | `agent` (required), `instructions`, `verdict` + settings | Runs the subagent `plugins/agents/<agent>.md` |
| `skill` | `skill` (e.g. `doz-agent:ship-feature`) + settings | Runs a skill |
| `action` | `command` and/or `action` (a name in `plugins/actions/`) | A shell command in the project folder (test, lint, build). Exit code 0 = PASS, so it can wire straight into a condition |
| `condition` | `source`, `check` | Picks a branch. First it uses the exit code (if `source` is an action) or the `VERDICT: PASS/FAIL` line in `source`'s output; failing that, the main thread answers the `check` from that output |
| `approval` | `message` | Halts until a human approves (`when: true`) or rejects (`when: false`) |
| `info` | `text` | A note. Wired into a node, its text goes into that node's context |
| `output` | - | Collects the output of every preceding agent/skill into a final report |

`label` can be set on any node. `verdict: true` asks the agent to close its answer with `VERDICT: PASS/FAIL`, so the condition doesn't need another LLM call.

### Edges

- `{ from, to }`: `from`'s output flows into `to`.
- An edge leaving a `condition`/`approval` must have `when: true|false`.
- `loop: N` marks a back edge: the target node and all its descendants are repeated with feedback, N times max. A cycle without `loop` is rejected.

### Settings (in `defaults` or on an agent/skill node)

Precedence: **node > workflow defaults > the agent's frontmatter**.

| Key | Values | Default | Notes |
|---|---|---|---|
| `model` | `opus`/`sonnet`/`haiku` | from the agent | |
| `permission` | `read-only` | per the agent's tools | Adds "Do not modify any file" to the prompt |
| `inputs` | `previous`/`all`/`none` | `previous` | Which nodes' output goes into the prompt. The less, the cheaper in tokens |
| `max_output_chars` | number | 12000 | Preceding nodes' output is truncated here |
| `retry` | number | 0 | Run the node once more if it fails or returns no report |

`parallel` (top level, default 3) caps how many ready nodes run at once.

## Stored actions (`plugins/actions/`)

Frequently used commands can be stored as files:

```markdown
---
name: jalankan-test
description: Run the project's test suite
command: npm test --silent
---

Notes on when to use it.
```

An `action` node references it with `action: jalankan-test`. A `command` on the node overrides the file's command. Only `run-workflow` reads actions.
