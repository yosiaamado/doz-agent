---
name: product-ownership
description: Use when discussing a new feature's scope or impact, or when asked for user stories, acceptance criteria, refinement, story splitting or MVP scope. A technique reference; the product-owner agent owns the workflow and report format.
effort: high
---

# Product Ownership

The PO **maximises the product's value**: setting the Product Goal, creating clear backlog items, ordering them, and keeping them transparent.

The PO decides **what** and **why**. The engineering team decides **how**. The PO doesn't dictate implementation, but must make sure the requirement is clear enough to work on without guessing.

## 1. Order of thinking

1. **What's the problem?** Who experiences it, how often, what's the evidence, and what happens if it isn't built?
2. **Does it move us towards the Product Goal?** If not, say so plainly.
3. **The current state.** Don't assume the feature doesn't exist — check first.
4. **Impact** (section 2) → **scope** (MVP / later / non-goal) → **story + AC** (sections 3–4).

## 2. Impact dimensions

Check all of them, **write down only those affected**:

| Dimension | Question |
|---|---|
| **User** | Which roles are affected? Which flows change? Is anyone worse off? |
| **Business** | Which metric should go up? Which guardrail must not go down? |
| **Frontend** | Which pages, components, state, routing change? |
| **Backend** | Which endpoints, services, jobs, integrations change? Breaking changes for other clients? |
| **Data** | New tables/columns? A migration? Does existing data need a backfill? |
| **Security & privacy** | Auth, roles, personal data (Indonesia's UU PDP), payments, uploads? |
| **Operations** | New config/env, feature flags, monitoring, deploy changes? |
| **Dependencies** | Does it depend on another feature, a third party, or an unmade decision? |

Close with the **risk** (low/medium/high) and a **rough size** (S/M/L/XL).

## 3. User story (INVEST)

**As a** <specific role>, **I want** <capability>, **so that** <benefit>.

- **I**ndependent — can ship without waiting on another story.
- **N**egotiable — describes the need, not the implementation.
- **V**aluable — the value is visible to a user or to the business.
- **E**stimable — clear enough to estimate.
- **S**mall — finishable in 1–3 working days.
- **T**estable — it's clear when it counts as done.

## 4. Acceptance criteria

```
Scenario: <name>
Given <initial condition>
When <action>
Then <observable result>
```

Must cover: the happy path · failed validation (empty, wrong format, upper bound) · access rights (401, 403, someone else's data) · empty state, 404, server error · specific business rules.

Avoid criteria that can't be tested ("fast", "user friendly"). Turn them into something measurable: "results appear in < 1 second for 1,000 products".

## 5. Definition of Ready

- [ ] The problem and its value are clear, and tied to the Product Goal.
- [ ] The ACs are complete and testable.
- [ ] A UI/flow design exists, or text is enough to describe it.
- [ ] The API contract is agreed (for FE + BE features).
- [ ] Dependencies and open questions are answered **or have a default in use**.
- [ ] It's small. If not, split it (section 6).

## 6. Story splitting

Split **vertically** — each piece still delivers end-to-end value, not one technical layer at a time:

- **Workflow:** the minimal step first, variations later.
- **Business rules:** the general rule first, the exceptions later.
- **Data variations:** one kind first (e.g. one payment method).
- **CRUD:** create + read first, update + delete later.
- **Happy path first,** edge cases as a separate story if they're large.
- **Spike:** technical uncertainty → a time-boxed research story first.

## 7. Prioritisation

- Order by value, risk, dependencies, and cost. RICE/WSJF/MoSCoW live in the `business-thinking` skill if you need to compare several items.
- Do the riskiest or least certain work early so you learn fast.
- Every item that goes in means something else doesn't get done. Name the trade-off.

## 8. Accepting the work

- Check each AC one by one: **pass / fail / cannot be checked yet**.
- Decision: **Accept** · **Accept with notes** (small remainder goes to the backlog) · **Reject** (name the criteria that failed).
- Record which metrics will be watched after release and when they'll be reviewed.
