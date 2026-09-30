---
name: engineering-workflow
description: How a professional software team works (SDLC). Covers Definition of Ready/Done, branching, Conventional Commits, PR size & description, code review etiquette, SemVer & releases, ADRs, tech debt, and incidents & postmortems. Use when starting or finishing a task, creating a commit/branch/PR, writing a PR description or changelog, recording an architecture decision, or handling an incident.
---

# Engineering Workflow

How a professional engineering team works from ticket to production. If the project or team has its own process (PR template, commit format, branching), **follow theirs**.

## 1. The work cycle

```
Ticket (Ready) → Brief design → Branch → Code + Tests → PR → Review + CI green → Merge → Deploy → Verify in production → Done
```

The core principles:
- **Small, frequent changes** are safer than large, rare ones.
- **Automate** everything that can be automated: lint, tests, build, and deploy.
- **"Done" means running in production and verified**, not just "the code is written".

## 2. Definition of Ready (before you start)

A task is ready to work on when:
- [ ] The goal and the business reason are clear (why this is being done).
- [ ] The acceptance criteria are testable. Use **Given / When / Then** where possible.
- [ ] The scope is clear, including what is **not** being done.
- [ ] Dependencies (API, design, access, data) are available or known.
- [ ] It's small enough to finish in a few days. If not, split it first.

If something is missing, **ask before writing code**. Misunderstanding the requirement is the biggest waste there is.

## 3. Design before code

- **Small task:** a brief plan naming the files to change and the approach is enough.
- **Large or risky task** (data schema, public API contract, architecture, security): write a short design doc with the context, options, decision, and risks. Get sign-off first.
- Important architecture decisions are recorded as an **ADR** (see section 9).

## 4. Branching

- **Trunk-based development:** `main` is always deployable. Branches are short-lived (ideally < 2 days), then merged via a PR.
- Branch names: `<type>/<ticket-id>-<short-description>`. Examples: `feat/SHOP-123-checkout-voucher`, `fix/SHOP-130-double-charge`.
- An unfinished feature may be merged as long as it's hidden behind a **feature flag**. Don't accumulate long-lived branches.
- Never force-push to `main` or a shared branch.

## 5. Commits (Conventional Commits)

```
<type>(<scope>): <imperative summary, lowercase, no period>

<body: why this change was made, not what changed>

<footer: Refs: SHOP-123 | BREAKING CHANGE: ...>
```

| Type | When |
|---|---|
| `feat` | A new user-facing feature |
| `fix` | A bug fix |
| `refactor` | Structural change with no behavior change |
| `perf` | A performance improvement |
| `test` | Adding or fixing tests |
| `docs` | Documentation |
| `build` / `ci` | Build system or pipeline |
| `chore` | Routine work (dependency updates, etc.) |

The rules:
- **One commit = one logical change.** Don't mix a refactor with a feature.
- The summary is ~72 characters max.
- Add `!` or a `BREAKING CHANGE:` footer for a change that breaks compatibility.
- **Don't commit** secrets, build output, `.env`, or commented-out code.
- Commit and push only when the user asks.

## 6. Pull Request

**Size:** ideally < 400 changed lines (excluding generated/lock files). A large PR is split into several PRs that can be reviewed separately.

**Description template:**

```markdown
## Why
<the problem / goal, link to the ticket>

## What changed
- <main change bullets>

## How to test
- <manual verification steps + automated tests added>

## Risk & rollback
- <impact, migrations, feature flags, how to roll back>

## Screenshots (if the UI changed)
```

Before asking for review:
- [ ] CI green: lint, type-check, tests, build.
- [ ] Self-review your own diff first.
- [ ] No debug logs, no TODOs without a ticket, no dead code.
- [ ] Documentation, `.env.example`, and the changelog updated where needed.

## 7. Code review

- **The goal is improving the health of the codebase, not finding perfect code.** Approve when the change clearly makes things better, even if it isn't ideal.
- **Order of focus:** design → correctness → complexity → tests → naming → comments → style.
- **Label every comment** (Conventional Comments):
  - `issue (blocking):` must be fixed before merge
  - `suggestion:` a suggested improvement, optional
  - `question:` asking for an explanation
  - `nit:` minor or stylistic, optional
  - `praise:` something done well
- Critique the code, not the person, and explain the **reason**.
- Style and formatting that can be automated are left to the linter/formatter, not argued about in review.

## 8. Definition of Done

A task is **done** when:
- [ ] Every acceptance criterion is met and verified.
- [ ] There are automated tests for the new behavior and for any bug fixed (regression tests).
- [ ] Lint, type-check, tests, and build pass.
- [ ] It has been reviewed and approved.
- [ ] There are no known security problems. Input is validated and authorization is checked.
- [ ] Logging and metrics are adequate for debugging in production.
- [ ] Documentation (README, API docs, runbook, ADR) is updated.
- [ ] It's deployed and verified, or ready to deploy with a clear rollback step.

## 9. ADR (Architecture Decision Record)

Store them in `docs/adr/NNNN-title.md`. One decision per file, and don't change it once accepted. If the decision changes, write a new ADR that supersedes it.

```markdown
# NNNN. <Decision title>

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
<the problem, constraints, and influencing factors>

## Decision
<what was chosen>

## Options considered
<the other options + why they weren't chosen>

## Consequences
<positive and negative effects, and what must be followed going forward>
```

## 10. Versioning & releases

- **SemVer:** `MAJOR.MINOR.PATCH`.
  - MAJOR: there's a breaking change.
  - MINOR: a new, compatible feature.
  - PATCH: a bug fix.
- `CHANGELOG.md` follows the Keep a Changelog format: Added, Changed, Deprecated, Removed, Fixed, Security.
- Releases are marked with a git tag (`v1.4.0`). Artifacts are built once, then promoted between environments (dev → staging → prod).
- A feature being removed is first marked **deprecated** with a clear timeline, and only then removed.

## 11. Tech debt

- Tech debt may be taken on **deliberately**, but it must be recorded as a ticket with the impact, an estimate of the cost to fix, and the trigger for when it has to be paid off.
- Apply the **boy scout rule:** leave the code a little tidier than you found it, as long as it stays within the PR's scope.
- A `TODO` in the code must carry a ticket ID: `// TODO(SHOP-140): ...`

## 12. Incidents & postmortems

**Severity levels:**

| Level | Example | Response |
|---|---|---|
| SEV1 | Main service down, data breach, mass payment failures | All hands on it now, regular updates to stakeholders |
| SEV2 | Important feature broken, no workaround yet | Handled immediately, in working hours or on-call |
| SEV3 | Feature broken but a workaround exists | Scheduled in the current sprint |
| SEV4 | Cosmetic, minor impact | Goes to the backlog |

**During an incident:**
1. **Recover first, investigate after.** Roll back, kill the feature flag, or scale.
2. One person leads (the incident commander), and there's a single communication channel.
3. Record the timeline while the incident is still running.

**A postmortem** is mandatory for SEV1–SEV2, and is **blameless** (focused on the system, not on blaming people). It contains:
- A summary of the impact
- The timeline
- The root cause (5 Whys)
- What went well and what didn't
- Action items with an owner and a deadline
