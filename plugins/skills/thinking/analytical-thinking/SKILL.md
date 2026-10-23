---
name: analytical-thinking
description: Use when the user asks for analysis, why something is happening, a comparison of options, which choice is better, or an estimate; when a bug is hard to track down; or when a technical decision has many factors.
effort: high
---

# Analytical Thinking

The goal: an answer that is **correct and defensible**, not a guess that sounds convincing.

## 1. Define the problem

- Restate the problem in one sentence: what's the symptom, where, since when, how often, and who is affected?
- Separate **facts** (visible in logs, data, or code) from **assumptions** and **opinions**.
- Set the "done" criteria: what does the correct state look like, and how will it be measured?
- Make sure the problem you're solving is the right one. Ask: why does this matter?

## 2. Break the problem down (MECE)

- Decompose it into parts that are **non-overlapping and cover every possibility** (Mutually Exclusive, Collectively Exhaustive).
- Example for "the API is slow": client → network/DNS → load balancer → app (CPU, memory, GC, locks) → DB (queries, locks, connections) → external services.
- Use an **issue tree:** problem → sub-problems → testable questions.
- **First principles:** when stuck, return to the basic facts (what is definitely true?) then rebuild the reasoning from there.

## 3. Hypotheses & verification

- Form several hypotheses, then order them by **likelihood × how cheap they are to check**.
- For each hypothesis, decide up front what evidence would **confirm** or **refute** it, then go looking.
- **Change one variable at a time.** Record each attempt along with its result.
- **Systematic debugging:**
  1. Reproduce the problem consistently.
  2. Narrow it down by bisection (`git bisect`, disabling components one at a time, or a binary search through the data).
  3. Compare a working case against a failing one: what's different?
  4. Check what changed recently: deploys, config, dependencies, and data.
- Don't conclude without evidence. "Probably because of X" is not the same as "because of X".

## 4. Root cause

- **5 Whys:** keep asking "why" until you reach a cause that, once fixed, stops the problem recurring.
- Distinguish:
  - **Trigger:** the event that started the problem.
  - **Root cause:** the underlying weakness that made the problem possible.
  - **Aggravating factors:** things that made the impact worse.
- For problems with many causes, use a **fishbone diagram** with the categories: people, process, technology, data, environment.
- Also ask: **why wasn't this caught earlier** (tests, monitoring, review)? That's usually the most valuable fix.
- Focus on the system and the process, not on blaming people (blameless).

## 5. Estimation

- **Fermi estimation:** break a big number into factors you can reasonably guess, then multiply. Write down every assumption.
  - Example: requests/day = active users × sessions per user × requests per session.
- Give a **range, not a single number**: optimistic / realistic / pessimistic.
- For effort estimates, break the work down to the smallest unit. Add buffer for the unknowns (integration, testing, review, deploy).
- Compare against historical data where available. People are systematically over-optimistic.

## 6. Comparing options

**Classify the decision first:**
- **Two-way door** (easy to reverse): decide fast, ~70% of the information is enough.
- **One-way door** (hard or expensive to reverse — e.g. a data schema, a language/framework, vendor lock-in, a public API contract): analyse more deeply and write it up as an ADR.

**A weighted decision matrix:**

| Criterion (weight) | Option A | Option B | Option C |
|---|---|---|---|
| User/business impact (30%) | | | |
| Effort / time (20%) | | | |
| Risk (20%) | | | |
| Maintainability / complexity (15%) | | | |
| Total cost (TCO) (15%) | | | |

Score 1–5, multiply by the weight, then sum. Adjust the weights to fit the context.

- **Always include the "do nothing" option** as a baseline.
- State the **trade-offs** explicitly: what each option gives up.
- **Second-order effects:** what are the downstream consequences in 3–12 months? Who else is affected?
- **Pre-mortem:** imagine this decision has failed completely six months from now. What's the most likely cause? Mitigate that cause now.
- **Sensitivity test:** does the decision change if one key assumption is off by 2×?

## 7. Data & evidence quality

- Check the source and quality of the data: big enough sample? representative period? any missing data or outliers?
- Use **percentiles (p50/p95/p99)**, not just averages, for latency and skewed distributions.
- Compare against a **baseline** (before vs after, a control group).
- Distinguish levels of evidence:
  - Directly measured > from logs/metrics > from the code > from documentation > from memory/assumption.

## 8. Avoiding bias

| Bias | Counter |
|---|---|
| Confirmation bias | Look for evidence that **refutes** your own hypothesis |
| Anchoring | Don't fixate on the first explanation or number |
| Correlation ≠ causation | Find the causal mechanism and test it with an experiment |
| Survivorship bias | Account for the data you can't see (users who already churned, requests that timed out) |
| Sunk cost | Judge options by their future, not by what's already been spent |
| Recency / availability | Check historical data, not just the most memorable recent event |

If the data is insufficient, **say so** and name what data is needed and how to get it.

## 9. Answer format

```
**Conclusion:** <1-2 sentences, the direct answer>
**Confidence:** <high/medium/low> — <why>
**Evidence:** <supporting facts with sources: file:line / logs / numbers>
**Reasoning:** <the short logical chain>
**Options & trade-offs:** <if there is a choice>
**Recommendation:** <concrete actions, in priority order>
**Uncertainty:** <what isn't settled + how to settle it>
```

Lead with the conclusion (bottom line up front). The confidence level must match the evidence. For a one-way door decision, offer to write it up as an ADR.
