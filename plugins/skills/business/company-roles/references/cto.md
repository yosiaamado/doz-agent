# CTO playbook
Last reviewed: 2026-11-08

## What this role owns
- Decides: technology bets tied to revenue, build vs buy, debt funding, rewrite calls, team shape, security posture, AI policy, vendor exposure.
- Accountable for delivery reliability and for technical risk stated in business terms.
- Leaves to others: task breakdown (technical-lead), scope and priority (product-owner), budget limits (cfo).

## First questions
1. What revenue or deal does this enable or protect? No link, no urgency.
2. Product, client projects, or both, and how are engineers split? Billable pressure decides what capacity is real.
3. Team size and seniority? Under 4 people, many "best practices" are unaffordable.
4. Deploy frequency, failure rate, recovery time? Without these, debt claims are opinion.
5. What personal data, for whom, stored where? Sets legal exposure and audit needs.
6. What's the runway? Six months and three years justify opposite architecture spending.
7. Who could leave and take the system with them? Key-person risk often outranks code quality.

## Decision frameworks
- **Build vs buy**: any new capability. Build only what customers pay you to do better; buy the rest. Compare total cost including maintenance, on-call, exit.
- **Debt ledger**: when engineers ask for "cleanup time". Each item names a symptom: lost deal, incident hours, slower delivery. Fund it, or record acceptance with an owner.
- **Rewrite test**: default no (Spolsky): refactor, tune the slow part, tidy. Replace in slices if seams exist (Fowler). Whole-system only if legacy blocks revenue, no seams exist, and the organization changes too.
- **One-way doors**: data model, tenancy, primary cloud, identity. Spend review there; decide the rest fast.
- **Lock-in price**: before signing. Export path, notice terms, migration estimate, currency. Accept if exit cost is below value gained.
- **Delivery metrics**: lead time, deploy frequency, recovery, change fail, rework. Team trend only; read speed and instability together; never rank individuals.
- **Team sizing** (Larson): steady 6-8 per manager. Grow to 8-10, then split. Two-tier 24/7 on-call needs ~8: below that, buy managed services or narrow the promise.
- **AI adoption**: pilot on real tasks, measuring cycle time and rework, not self-report. Weak tests or CI: fix first. Decide what data reaches models before rollout.
- **Security minimum**: MFA, tested restore, retained logs, secrets management, offboarding. Then customer audits and data class set the next spend.
- **Stage check**: still every fire's first responder at ~100 people: hand off. Not coding at ~10: ask who builds.

## Benchmarks
| Stage | Rule of thumb | Source, date |
|---|---|---|
| Early (~10) | CTO is the tech department: stack, first hires, last-resort bug fixer | Kravcenko, 2023, updated 2026 |
| Early | Team under 4 behaves as individuals | Larson, Jul 2018 |
| Small (~100) | Process, debt, compliance, culture; stops fixing every fire | Kravcenko, 2026 |
| Scaling (~1000) | Multi-year strategy, M&A; execution moves to VPs (author: secondhand) | Kravcenko, 2026 |
| All | Experienced devs, own repos: expected 24% faster, measured 19% slower, felt 20% faster. n=16, early-2025 tools | METR via The Register, Jul 2025 |
| All | ~90% use AI; throughput up, instability still up | DORA via InfoQ, Sep 2025 |

## Indonesia
Mostly law-firm sources; read the regulation text before relying.
- **PP 33/2026** (implements UU 27/2022): effective 16 Jan 2027. Fines up to 2% of annual gross revenue. Breach notice within 3x24 hours of confirming the failure: keep logs and forensics. AI triggers DPIA. DPO if any one condition is met. Agency not fully formed Sep 2026; no reason to wait (SIP Law, Oct 2026).
- **Offshore AI and cloud**: transfers rely on adequacy, agency SCCs, BCRs, or narrow one-off consent; lists and SCCs await the agency (SIP Law, Oct 2026). Log transfers now.
- **PSE**: private operators register before use; unregistered ones risk graduated sanctions up to blocking (Smartlegal, Nov 2025). Check scope.
- **Sector rules**: OJK, public-sector data placement, BSSN: ⚠ NEEDS VERIFICATION. Ask for the customer's clause.
- **Talent**: engineer total comp medians: entry Rp96.8m, all levels Rp222.5m, senior Rp356.6m a year (Levels.fyi, Aug 2026).

## Traps
| Excuse | Reality |
|---|---|
| The code is a mess, rewrite it | Mess often holds real-world fixes; unfamiliar code looks worse |
| Rewrite only takes six months | Users wait while behavior is rediscovered |
| Microservices will let us scale | With under 4 per team, services outnumber owners |
| Build it, we have engineers | Their time has a price; maintenance never ends |
| Target elite DORA | 2025 reports team profiles; compare with your own trend |
| AI made us 30% faster | Self-report misled METR's participants; measure |
| Security after product-market fit | Audits and fines don't wait for your roadmap |
| Juniors are cheaper | Without review capacity, cheap output becomes rework |
| Avoid lock-in at all costs | Portability costs too; pay only for likely exits |

## How a senior pushes back
- Won't call debt urgent without an incident, delay or lost-deal number.
- Won't approve a rewrite without a slice plan and stop condition.
- Asks who leaves billable work before agreeing a date.
- Rejects "we're secure" without a tested restore and log evidence.
- Restates technical asks as cost, risk and revenue.

## Hand off to
- technical-lead: task breakdown. product-owner: scope, acceptance.
- cfo: budget against runway. ceo: bets changing the business model.
- legal-counsel: PDP, PSE, vendor terms. hr-lead: hiring, pay bands.
- coo: client delivery capacity. customer-success-lead: incident comms. sales-director: security promises in deals.

## Sources
- Things You Should Never Do, Part I — Joel Spolsky — https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/ — accessed 2026-11-08
- Strangler Fig — Martin Fowler — https://martinfowler.com/bliki/StranglerFigApplication.html — accessed 2026-11-08
- Sizing engineering teams — Will Larson — https://lethain.com/sizing-engineering-teams/ — accessed 2026-11-08
- What does a CTO actually do? — Vadim Kravcenko — https://vadimkravcenko.com/shorts/what-cto-does — accessed 2026-11-08
- DORA 2025 — InfoQ — https://www.infoq.com/news/2025/09/dora-state-of-ai-in-dev-2025 — accessed 2026-11-08
- AI code tools slow down — The Register — https://www.theregister.com/2025/07/11/ai_code_tools_slow_down/?td=rt-3a — accessed 2026-11-08
- PP 33/2026 — SIP Law Firm — https://siplawfirm.id/resources/pp-33-2026-pelindungan-data-pribadi — accessed 2026-11-08
- Daftar PSE — Smartlegal — https://smartlegal.id/pse/2025/11/17/cara-daftar-pse-kominfo-ini-prosedur-dasar-hukum-dan-persyaratannya-sl/ — accessed 2026-11-08
- SWE salaries — Levels.fyi — https://www.levels.fyi/t/software-engineer/locations/indonesia.md — accessed 2026-11-08
