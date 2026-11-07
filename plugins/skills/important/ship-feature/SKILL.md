---
name: ship-feature
description: Use when the user wants a feature, change or bugfix built end to end — "build/add feature X", "kerjain sampai selesai", "ship it", "end-to-end" — or invokes /ship-feature. Don't use when the user only wants discussion, analysis or a review without implementation.
argument-hint: "[--engineer-model opus|sonnet] <feature/change description>"
effort: high
---

# Ship Feature

You (the main thread) are the orchestrator. Take the following request all the way to done with as **few agents as possible** without lowering quality.

**Request:** $ARGUMENTS

If the section above is empty, use the user's request from their last message.

If the request starts with `--engineer-model <opus|sonnet>`, that's a model experiment, not part of the request. Every new engineer call uses that model via the `model` parameter of the `Agent` tool. The results get compared later with `/doz-agent:token-audit --compare`.

Agents cannot invoke other agents. You invoke every agent via the `Agent` tool with `subagent_type` `doz-agent:<name>`. The user never has to pick an agent.

## Thinking & output rules

These decide whether the whole flow is cheap or wasteful:

- **Sizing is capped at ~5 file reads.** Once the size is set, don't re-analyse it.
- **Don't invoke an agent for something you can do yourself with the context you already have.** Every agent pays for exploration from scratch. Writing the contract, the brief, or a small change yourself is almost always cheaper.
- **Updates to the user: 2 lines max per stage.** No narrating the plan, no "now I will…", no pasting diffs or file contents. The full report comes once, at the end.
- **Don't forward a whole agent report to another agent.** Point at the spec file and condense the rest into the points the recipient needs. The main thread's context is resent every turn — that cost compounds.
- No task list for a flow under 3 steps.

## 1. Size the work (yourself, no agents)

`CLAUDE.md` is already in your context (the ones in subfolders load when a file there is read), so don't read it again. Explore just enough (within the cap above), then keep your findings to pass on to the next agent.

| Size | Signs | Flow |
|---|---|---|
| **Small** | 1–3 files, one layer, no API contract/DB schema change, doesn't touch a sensitive area* | Do it **yourself with no agents**, run the related tests, done |
| **Medium** | The requirement is already clear, no new business decisions | Skip product-owner. Contract (step 3) → engineers → verification |
| **Large** | New feature, new business rules, the requirement is still fuzzy, or it touches a sensitive area* | product-owner → contract (step 3) → engineers → verification → acceptance |

\* Sensitive areas: auth/session, roles/authorization, user input reaching the DB/commands, uploads, payments, personal data, webhooks, secrets.

State the size + the reason in **one sentence**, then move straight on.

If there is a visual AC or a flow requiring login (e.g. an admin page) and browser tooling is available → ask the user to log in in the browser **now**, so the visual check can happen before the final report. You never type a password. No browser tooling → write "visual not checked" in the final report.

## 2. Product owner (Large only)

Invoke `doz-agent:product-owner` with the user's request, the project path, and your findings. The PO works in **a single pass** — don't invoke it twice for the same requirement.

- `[MUST ANSWER]` → ask via `AskUserQuestion` (4 at a time max, the PO's default as the first option), then continue.
- `[ASSUMPTION]` → take it as-is, note it for the final report.
- Follow the PO's **Agent plan**.

## 3. The shared working brief

A single `docs/specs/<slug>.md` file is the reference for every agent, so nobody explores the repo from scratch.

```markdown
## Repo context
<stack, build/test/lint commands, important paths, conventions — from step 1>
## Requirement
<user story + ACs, or the user's request if there was no PO>
## Slices
- S1 <name> — AC-1, AC-2 — BE/FE   (one slice = one engineer call)
## API contract
### <METHOD> <path>
- Auth · Request (params/body + validation) · Response 2xx (JSON example) · Errors (status → when → example body)
## File map
### Backend / ### Frontend
- [S1] <path> — <create/change> — <what> (follow the pattern at: <path:line>)
## Interfaces
- [S1] <path> · `<exact signature / type / props / event payload>` — what the other side or a later slice relies on
## Tests
- [S1] <test name> — asserts <exact condition and value>
## Review focus
- RF-1 [S1] <input or failure mode the spec implies but no AC names> → test: <name>
## Decisions & assumptions
```

Who writes it:

| Condition | How |
|---|---|
| **Default** (1–2 endpoints, the project's API pattern is already clear) | **Write it yourself.** You already have the context; checking one similar endpoint for the convention is enough |
| ≥3 endpoints, a migration/schema change, or a complex domain | Invoke `doz-agent:system-analyst`. The exploration cost is worth the rework risk |
| The response shape can't be pinned down yet, or the FE portion is tiny | **Skip the up-front contract.** `backend-engineer` first, take the final contract from its report, then `frontend-engineer` |
| Only one layer (FE only or BE only) | No contract. "Repo context" + "Requirement" + "File map" is enough |

**A brief records decisions, not code.** For each slice it contains: (1) the files to create or change, with a pattern to follow; (2) the exact interfaces other code depends on — signatures, types, props, payloads; (3) the values from the spec — limits, constants, error codes, formats; (4) each test by name with the condition and value it asserts; (5) the Review focus items the slice owns. Write a code body only for an algorithm those five don't determine. If code blocks make up most of the spec, replace the bodies with signatures and assertions.

**Review focus: up to 5 items.** Inputs or failure modes the requirement implies but no AC names, each owned by one slice and pinned by one named test. Look first where bugs have actually slipped past self-review: an "A or B" AC (one test per branch), a lookup by id from a paginated or filtered list, a list/aggregate endpoint that must respect the underlying resource's permission, clearing a value (`null`, empty, back to default), existing records that predate the change, and style precedence (inline style vs class). No such risk → write "Review focus: none".

**The file map is mandatory** — it's what bounds the engineers' scope and prevents re-exploration. More than 1 engineer per layer → write the owner of each file/folder; a file must never have two owners. Open questions affecting the contract are handled like step 2.

## 4. Execution

- The contract exists → invoke `backend-engineer` and `frontend-engineer` **in parallel, in one message**.
- **One engineer call = one slice.** The next slice is sent once the previous one is `done`: same area → `SendMessage` to the same engineer; a different area → a new call. Engineers may run in parallel only if their file maps don't overlap.
- Give each engineer a unique `name` when invoking it (e.g. `be-<slug>`, `fe-<slug>`) so it can be continued later.
- The prompt to an engineer stays short: the project path, the spec path, the slice to work on (its Interfaces, Tests and Review focus items are in the spec), the build/test commands, and "don't read the other side's code; don't re-explore areas the spec already describes; don't edit the spec file".
- Engineers must run **self-review** and include an **AC/RF → test map** in their report (every AC and every Review focus item of the slice). A report missing that map, or with a full suite that hasn't been run → send it back to the engineer first, don't proceed to verification.
- **Read the first line of the engineer's report (`Status:`) first:** `done` → continue · `partial` → continue with the remaining work · `needs-decision` → decide yourself, or ask the user if it's a business matter · `blocked` → clear the blocker or report it to the user · `too-big` → split it as proposed.
- **Continue the same engineer, don't invoke a new one,** after a `needs-decision` is answered, a `blocked` is cleared, the first piece of a `too-big` split is decided, on `partial` or a stop from `maxTurns`, or when its report was sent back. Send it via `SendMessage` to its `name` (or its agentId). Its context (exploration, decisions, code already written) is still intact, and within the hour its cache is reused too, so the engineer doesn't start from zero.
- Engineers keep a per-project memory of the code map, so a feature in an area they've touched before is much faster. Still write the file map — that memory is a pointer, not a substitute for the brief.
- `devops-engineer` only if there's new env/config/CI/deploy.
- An engineer reports a contract it can't implement → **you** decide the change (ask the user if it's a business matter), update the spec, then notify the engineer on the other side.

## 5. Verification (parallel, one message)

Each agent's scope: the changed files + the acceptance criteria + the spec path + **the Verification line from the engineer's report** (build/test results), so the reviewer and QA don't rerun a suite that's already green. To `qa-tester`, also include the **AC/RF → test map** from the engineer's report, so QA tests the gaps instead of repeating existing tests. To both `code-reviewer` and `qa-tester`, include the spec's **Review focus** list: each item must have a test that would fail if the code got it wrong.

| Agent | When |
|---|---|
| `code-reviewer` | Always (Medium & Large) |
| `qa-tester` | New or changed logic, or acceptance criteria. FE ∥ BE → ask it to check the integration against the API contract. Skip for pure presentation/copy changes |
| `security-tester` | Only if it touches a sensitive area |

Diff larger than ~25 files → split `code-reviewer` per layer (BE, FE) or per module, in parallel in one message. A verifier report containing `Not reviewed` → a new call for that area only.

## 6. The fix loop

- **Wait for every verification agent to finish**, then merge the blocking findings (🔴 from the reviewer, QA bugs, Critical/High security, contract mismatches) into **one batch per engineer**. **Copy the finding lines verbatim** (`CR-1 path:line: …`, `QA-BUG-1 …`, `SEC-1 …`), don't rewrite them. One call per engineer, not one per finding.
- Pick how to send the batch to the engineer:
  - A finding requires design understanding (the contract, a flow across files, a wrong approach) → **continue the same engineer** via `SendMessage`. It still remembers why the code was written that way.
  - All findings are local with a clear `path:line` → **a new call**. The engineer's large old context doesn't need re-reading on every fix turn.
- Start the fix prompt with **"Fix mode"**, so the engineer adds regression tests, reruns the full suite + self-review, and stores the finding's pattern in memory.
- Re-verify **only with the agent that found it**, via **a new call** scoped to the fix alone: send the finding IDs + the engineer's status lines. Don't continue the old verifier: its context is large and its 5-minute cache has expired.
- **2 rounds max.** Still blocking → stop and report to the user.
- Non-blocking findings aren't fixed automatically; they go into the final report.

## 7. Acceptance (Large only)

Invoke `doz-agent:product-owner` in Acceptance mode with the spec path, the list of changed files, and a **summary** of the verification results.

## 8. The gate before reporting done

Don't say it's done before: build/lint/tests have **actually been run** (not assumed), every acceptance criterion has a status, and no blocking findings remain. Anything that couldn't be run → say so explicitly.

## 9. Final report

```
## Done: <feature>
Size: <Small/Medium/Large> · Agents: <list> · Spec: <path / none>

## What changed
- <file/area>: <summary>

## Verification
Build/test: <result> · Review: <decision> · Security: <result / not needed> · Acceptance: <Accept/Reject / not needed>

## Assumptions & non-blocking notes
- ...
```

## 10. Token audit (Medium & Large)

After the final report, invoke `doz-agent:token-audit` via the `Skill` tool with no arguments. Show its output below the final report as-is. Its script reads this workflow's transcript, then reports tokens per agent, the biggest gaps, failures & findings per category, recurring failure patterns, and suggested fixes. Audit failed → one line with the reason, then move on. Small is skipped: with no agents there's nothing to audit, and the output would only add context.

After that, at every size, ask whether the user wants to commit. **Don't commit or push without permission.**

## Saving tokens on the user's side

Mention these only when relevant, once:

- No `CLAUDE.md` in the folder being worked on → suggest `/init` there.
- A large feature that could be split → offer the first vertical slice instead of one full chain.
- Once a feature is done → a new session for the next feature is cheaper than continuing a long one.
