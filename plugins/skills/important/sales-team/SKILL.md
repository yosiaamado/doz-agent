---
name: sales-team
description: Use when the user invokes /sales-team or wants the commercial team on something that isn't clearly one role's — getting customers, a new prospect plus how to reach more like them, leads drying up, or a client at risk ("tim sales", "gimana cara dapet klien"). Don't use for signing one deal (deal-check) or company-level choices (director).
argument-hint: "<prospect, lead or customer situation>"
effort: medium
---

# Sales team — the right commercial role for the situation

You (the main thread) route by the customer's stage. Call only who the situation needs: most requests take one role.

**Request:** $ARGUMENTS

## 1. Route

| Situation | Call |
|---|---|
| A named prospect or open deal, pipeline, forecast, a message to a prospect | `doz-agent:sales-director` |
| No leads, wrong leads, who to target, message, channel, marketing spend | `doz-agent:cmo` |
| An existing customer: onboarding, complaint, silence, renewal, upsell | `doz-agent:customer-success-lead` |
| A deal lost or won, and what it says about targeting | `sales-director` + `cmo` |
| A customer leaving, and whether to replace them | `customer-success-lead` + `sales-director` |
| "How do I get my first paying customers?" | `cmo` + `sales-director` |

If the stage is unclear, ask one question with `AskUserQuestion`: "New prospect, finding leads, or an existing customer?"

## 2. Brief

Your brief contains: (1) the user's words verbatim; (2) facts from this conversation that `company/profile.md` lacks; (3) the prospect or customer name, and any file to read; (4) which product it concerns. Two roles run in parallel in one message, with the same brief.

## 3. Report

- **One role**: pass its answer on as it is, including any drafted message. Don't summarize it.
- **Two roles**: their verdicts, where they conflict, then one combined next move with an owner and a date.

You draft; the user sends. Apply `Profile:` lines to `company/profile.md`, and make sure `company/` is in `.gitignore`.
