---
name: weekly-review
description: Use when the user invokes /weekly-review or wants to review the business's week and decide what to do next ("review minggu ini", "minggu ini fokus apa", "progress gw gimana"), or when a scheduled weekly run starts. Don't use for one decision (director) or one deal (deal-check).
argument-hint: "[what happened this week]"
effort: medium
---

# Weekly review — one focus for next week

You (the main thread) run a short founder review. The output is one focus that fits the hours available, not a long list.

**Request:** $ARGUMENTS

## 1. Gather

1. Read `company-profile.md`, `sales-notes/*.md`, and the latest file in `weekly-reviews/`.
2. Ask only what those don't answer, in one `AskUserQuestion` call: what got done against last week's focus; hours available next week; any new prospect, client or money movement. Scheduled with nobody to answer: use what the files say and mark the gaps.

## 2. Run in parallel

One message, same brief, with: last week's focus and result, hours available, open deals, and the goal from the profile.

| Agent | Its question |
|---|---|
| `doz-agent:sales-director` | Which open deal deserves time next week, what's its next move, and which should be dropped? |
| `doz-agent:coo` | With these hours, what is the constraint, and what is the one thing to do and the one thing to stop? |

Tell both to write no notes this run, and to keep the answer under 150 words.

## 3. Report and save

Write this to `weekly-reviews/<YYYY-MM-DD>.md` and show it. Add `weekly-reviews/` to `.gitignore` if it isn't there.

```
# Week of <date>

Last focus: <what it was> → <done | partly | not done, and why>
Goal: <target from the profile> · Now: <actual> · Gap: <amount>
Pipeline: <deal — stage — next step date>, one per line

Focus next week: <one thing>
Tasks (fit in <n> hours):
1. <task — hours — day>
Stop or drop: <one thing>
Decision waiting: <question, and whether to take it to /doz-agent:director | none>
```

The hours must add up to no more than what's available. If the focus was missed two weeks running, say so plainly and ask what's blocking it, rather than setting it again.

Apply `Profile:` lines to `company-profile.md`, or suggest `/doz-agent:update-company` when a fact changed.
