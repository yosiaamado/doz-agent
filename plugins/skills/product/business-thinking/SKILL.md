---
name: business-thinking
description: Use when the user discusses a business or startup idea, which feature to build first, an MVP, pricing or monetisation, unit economics, target market, go-to-market, a roadmap, metrics or OKRs, build vs buy, or asks whether something is worth it ("worth ga").
effort: high
---

# Business Thinking

Every product and technical decision has to answer: **who benefits, by how much, at what cost, and how will we know it worked?**

## 1. Start from the problem, not the solution

- **Who** is the user or customer? Use a specific segment, not "everyone". Distinguish the **user** (who uses it) from the **buyer** (who pays).
- **What problem** do they have, how often, and how much does it hurt? Are they already spending money or time working around it?
- **How do they cope today** (a competitor, a spreadsheet, a manual process)? Why isn't that enough?
- **Jobs To Be Done:** "When [situation], I want [motivation], so I can [outcome]."
- **Lean Canvas** for a new idea: problem, customer segment, unique value proposition, solution, channel, revenue, cost, key metric, and unfair advantage.

## 2. Discovery & validation before building

- Write down the assumptions in play, then sort them into three buckets:
  - **Desirability:** do they want it?
  - **Viability:** is it profitable?
  - **Feasibility:** can it be built?
- Test the **riskiest and least certain** assumption first.
- **Cheap ways to validate**, cheapest first:
  1. User interviews. Ask about past behavior, not opinions about the future (The Mom Test).
  2. A landing page + waitlist.
  3. A fake door test.
  4. Pre-orders or an LOI.
  5. A concierge/manual MVP (serve them by hand first).
  6. A clickable prototype.
- **Set the success criteria before the experiment starts.** For example: "≥ 10% of visitors join the waitlist within 2 weeks".
- An **MVP** is the **smallest** version that can prove or disprove the core assumption, not a shoddy version of the full product.

## 3. PRD / one-pager (before a feature is built)

```markdown
# <Feature name>
## Problem
<who, what problem, evidence (data/user quotes)>
## Goal & success metrics
<the primary metric + target + the guardrail metric that must not drop>
## Non-goals
<what is deliberately NOT being done>
## Solution (condensed)
<the main flow, user story + acceptance criteria>
## Risks & assumptions
## Release plan
<phased? feature flag? an experiment?>
```

## 4. Prioritisation

- **RICE** = (Reach × Impact × Confidence) / Effort. Good for comparing many feature ideas.
- **WSJF / Cost of Delay:** (business value + time criticality + risk reduction) / job size. Good when there's a deadline or a risk.
- **MoSCoW** (Must / Should / Could / Won't) for cutting a release's scope.
- **Kano:** separate basic features (must exist), performance features (more is better), and delighters.
- Always ask: **if this feature is NOT built, what happens?** And what gets sacrificed if we do build it (opportunity cost)?

## 5. Business model & unit economics

- **Revenue sources:** subscription, transaction/commission (take rate), usage-based, one-time/licence, advertising, or freemium.
- **The core metrics:**
  - **CAC:** total acquisition spend ÷ new customers.
  - **LTV:** ARPU × gross margin × average customer lifetime (≈ 1 / monthly churn). Target **LTV : CAC ≥ 3 : 1**.
  - **CAC payback** ideally < 12 months (shorter for SMB/consumer).
  - **Gross margin:** count **all** variable costs, including servers, API/AI per request, payment fees, support, and refunds.
  - **Churn & NRR** (Net Revenue Retention). NRR > 100% means existing customers grow on their own.
  - **Burn rate & runway:** cash ÷ monthly burn.
- **Break-even:** fixed costs ÷ contribution margin per unit = the number of customers/transactions needed.
- Model it in a spreadsheet with **pessimistic / realistic / optimistic** scenarios, and write out every assumption explicitly.

## 6. Pricing

- Price against the **value** the user perceives (time or money saved, revenue gained), not just cost + margin.
- **Value metric:** the price rises with the value received (per user, per transaction, per volume).
- Build clear tiers (e.g. Free / Pro / Business) with meaningful differences. The middle tier usually becomes the default choice.
- Fit the local market: purchasing power, and the payment methods people actually use (QRIS, e-wallets, virtual accounts, buy-now-pay-later).
- **Test the price, don't guess it.** Use willingness-to-pay interviews (Van Westendorp), an A/B test on the landing page, or try it on new customers first.

## 7. Metrics & goals

- **North Star Metric:** the single metric that reflects the value users receive and correlates with revenue. For example: "successful transactions per week", not "number of downloads".
- **The AARRR funnel:** Acquisition → Activation → Retention → Referral → Revenue. Fix the leakiest stage first.
- **Retention** is the evidence of product-market fit. Look at the **cohort curve**: a healthy one flattens out, it doesn't keep falling to zero.
- **OKRs:**
  - A qualitative, inspiring Objective, with 2–4 measurable Key Results.
  - Key Results are outcomes, not outputs (features shipped).
- Avoid vanity metrics (total downloads, pageviews, signup counts) without activation and retention context.
- Every feature has **success metrics and a guardrail metric** defined **before** it is built.

## 8. Experiments & A/B tests

- **Hypothesis:** "If we [change X], then [metric Y] rises [Z%], because [reason]."
- Decide the primary metric, the guardrails, the minimum sample size (use a sample-size calculator), and the duration (at least 1–2 weekly cycles) up front.
- **Don't stop a test early** the moment it looks like it's "winning" (peeking). That biases the result.
- With low traffic, a large change or qualitative research beats A/B testing a small change.

## 9. Build vs buy

- **Buy or use an off-the-shelf service** for anything that isn't your core differentiator: auth, payments, email/SMS, analytics, search, and monitoring.
- **Build it yourself** only for what constitutes a competitive advantage, or when an off-the-shelf service doesn't meet the requirements, the cost, or the regulations.
- Calculate the **TCO** (total cost of ownership): build + maintenance + infrastructure + team time + risk, versus the subscription cost. Also weigh vendor lock-in and your exit plan.

## 10. Market & competition

- **Market size:** TAM → SAM → SOM. Calculate it **bottom-up**: reachable prospects × price × frequency. Don't just quote an industry report's number.
- **Positioning:** "For [segment] who [problem], [product] is the [category] that [primary benefit], unlike [alternative], because [differentiator]."
- **Moat:** network effects, exclusive data, switching costs, brand, scale/lower cost, distribution, or regulation.
- **Go-to-market:** which channel is the cheapest way to reach the first segment (communities, content/SEO, partnerships, direct sales, marketplaces)? Focus on one or two channels first.

## 11. Compliance & risk

- **Personal data:** comply with **UU PDP (Law No. 27/2022, Indonesia's personal data protection law)** for users in Indonesia, and GDPR if serving users in Europe. The basic rules:
  - Have a lawful basis for processing, and consent.
  - Collect as little data as possible.
  - Give users the right to access and delete their data.
  - Be ready to notify in the event of a breach.
- **Specific sectors** have their own regulations: payments/fintech (Bank Indonesia/OJK), healthcare, and children's education. Check before building.
- Also weigh reputational risk, dependence on a single platform (a social media algorithm, a marketplace, an app store), and dependence on one large customer.

## 12. Translating this into technical decisions

- Choose the **simplest solution sufficient for the current stage of the business.** Don't over-engineer before there's traction. Architecture for 1 million users isn't needed while there are 100.
- Put **analytics and event tracking in from the start** so decisions can be data-driven.
- **Tech debt may be taken on deliberately** to reach validation faster, as long as it's recorded and paid off before it becomes a bottleneck.
- Calculate the technical cost per unit (server/AI cost per transaction) and fold it into the gross margin.

## 13. Answer format

```
**Recommendation:** <the decision + a one-sentence reason>
**Key assumptions:** <what has to be true for this to work — and which is riskiest>
**Numbers:** <rough estimates with ranges: cost, revenue potential, unit economics>
**Success metrics:** <primary metric + target + guardrail>
**Risks:** <what could fail + the mitigation>
**Next steps:** <concrete experiments/actions, cheapest first, + the go/no-go criteria>
```

Be blunt when an idea is weak. Explain why with data or logic, then offer an alternative or a cheap way to validate it.
