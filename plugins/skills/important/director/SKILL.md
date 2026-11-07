---
name: director
description: Use when the user invokes /director, wants the leadership team's view on one decision, or asks for a board discussion across CEO, CFO, CTO, COO and CMO ("rapat direksi", "tanya para direktur") — which product to focus on, quitting a job, raising money, a big hire or spend. Don't use for one prospect (sales-team) or a question for a single named role.
argument-hint: "[roles] <the decision>"
effort: high
---

# Director — leadership team on one decision

You (the main thread) chair the meeting. The role agents give their views; you show where they split; the user decides.

**Request:** $ARGUMENTS

## 1. Prepare

1. Read `company/profile.md`. If it's missing, create it from [the template](../../business/company-roles/references/company-profile-template.md) with the facts the user stated and `TODO` for the rest, and add `company/` to `.gitignore`.
2. State the decision in one sentence, with its realistic options. If there is no decision yet ("gimana ya bisnis gw"), ask the user what they're deciding, with `AskUserQuestion` and options from the profile, and stop until they answer.

## 2. Choose the seats

Use the roles the user named. Otherwise:

| Decision touches | Seat |
|---|---|
| Always | `doz-agent:ceo`, `doz-agent:cfo` |
| Technology, build vs buy, technical feasibility | `doz-agent:cto` |
| Capacity, founder hours, delivery, process | `doz-agent:coo` |
| Market, customers, positioning | `doz-agent:cmo` |
| Contracts, IP, entity, regulation | `doz-agent:legal-counsel` |
| People | `doz-agent:hr-lead` |

Maximum 5 seats. "Semua direktur" or "all" means ceo, cfo, cto, coo, cmo.

## 3. Run them in parallel

One message, one `Agent` call per seat, so no role anchors on another. Every seat gets the same brief. Your brief contains: (1) the decision and options; (2) the user's words verbatim; (3) facts and numbers from this conversation that the profile lacks; (4) any files to read; (5) "answer from your role only".

## 4. Report to the user

```
Decision: <one sentence>

| Role | Verdict | Main reason |
|---|---|---|

Agree on: <what they share>
Split on: <the real disagreement, and which fact would settle it>
My recommendation: <one option, why, and what it costs>
Next step: <action — owner — date>
Your call: <the one thing only the user can decide>
```

Show the split as it is; don't average it. Agreement between roles built on the same assumption isn't confirmation, so name that assumption. Keep any `[⚠ verify]` label on a fact you repeat.

## 5. After

- **Stakes high and the split unresolved**: one more `doz-agent:ceo` call with each seat's verdict and reason, asking which to follow. One round only.
- **`Hand off:` lines**: follow one only if it could change the decision; otherwise list it under Next step.
- **`Profile:` lines**: apply them to `company/profile.md`.
