# RAB Generator — Synthesis & Recommendations

A reference for the `rab-kontraktor-advisor` skill. The product context and usage rules are in `SKILL.md`.

## Part 3: Synthesis & recommendations

### Indonesia vs international comparison

#### What's the same

- **The core formula is identical**: quantity × unit price = item cost, summed into a total. AHSP+HSPK is equivalent to a *unit rate buildup*; a BOQ is quantity × rate.
- **Both separate "technical requirements" from "market prices"** conceptually: AHSP coefficients vs HSD/HSPK prices in Indonesia; quantity (prepared by the QS) vs rate (filled in by the contractor when bidding) in a BOQ — although in Indonesia this separation is less visible, because the official HSPK already merges the two into a single ready-made figure per region.
- **Similar units of measurement**: m, m², m³, kg/tonne, OH/nr, lump sum/item.

#### What's different

| Aspect | Indonesia (AHSP/HSPK) | International (BOQ/AACE) |
| --- | --- | --- |
| Source of authority | Top-down government (Permen PUPR + a regional Perbup/Perwal, mandatory for government projects) | A professional standard (RICS), not state law, produced by independent quantity surveyors |
| Estimate maturity | No explicit system — an RAB is treated as "definite" once produced | AACE has 5 explicit classes with accuracy ranges tied to the design definition level |
| Items not yet certain | Generally no formal slot — small contractors often go "all-in"/guess | Formal provisional sums & prime cost sums for items unclear at tender |
| When it's produced | Often in parallel with, or before, the final design (house-scale projects rarely have complete working drawings) | After the design is finished, by a dedicated profession (QS), as part of the tender |
| Format standardisation | AHSP is standardised by regulation, but a small contractor's RAB Excel is free-form and inconsistent between contractors | Explicit measurement rules (NRM) — "two estimators measuring the same drawings produce bills that compare line by line" |
| Maturity of market software | Only simple local software so far (e.g. RAB Otomatis) with the official AHSP database | Mature software (Buildxact, PlanSwift, JobTread) with a reusable cost catalog/assemblies + live pricing |

**The conclusion for the product**: there's no need to copy BOQ/AACE wholesale (they're designed for large projects with professional QSs) — but three of their concepts are worth adopting in simplified form: (1) separate quantity from rate at the data level, (2) provide a slot for "not yet certain" items, (3) mark the estimate's maturity.

### Data structure recommendations

The main principle: **separate the "work item catalogue" (reusable) from "prices per project" (manual, per the MVP decision)** from the initial schema design — so that adding automatic price updates later (phase 2+, using official AHSP/HSPK data or live pricing) needs no large migration.

#### Core entities

| Entity | Purpose | Key fields |
| --- | --- | --- |
| `work_item` (work catalogue) | Master data owned by the contractor's account, reused across projects — analogous to an *assembly*/AHSP item | work name, category, default unit, notes |
| `project` | One RAB per project/client | project name, client, date, status ("Preliminary estimate" / "Final RAB") |
| `rab_item` (an RAB line) | One line in an RAB, belonging to one project | project_id, work_item_id (optional, nullable for one-off custom items), description, category, quantity, unit, unit_price, subtotal (computed), notes/assumptions, a "not yet certain" flag (optional, inspired by provisional sums) |
| `project_overhead` | Overhead & profit per project | a percentage or an absolute amount — a separate field, not hardcoded into each item, because the percentage (often assumed to be ~10% across various references) is really each contractor's decision, not a mandatory figure |

#### Why `work_item` is separate from `rab_item`

In the MVP, prices stay manual per project (`rab_item.unit_price` is typed in by hand) — but the *work name & unit* ("Lay 1 m² of red brick wall", unit m²) is almost always the same across projects. If `work_item` is its own entity from the start, contractors can save and reuse their list of work items (the insight from Buildxact/JobTread's cost catalog) without retyping it for every new project — and the structure is already ready to hold official coefficients/prices later without a schema redesign.

#### The RAB formula

```latex
Subtotal_{item} = Volume \times HargaSatuan
Total_{kategori} = \sum Subtotal_{item \in kategori}
Total_{proyek} = \sum Total_{kategori} \times (1 + Overhead\%)
```

#### Work categories

Provide a starter list of common categories following the SNI/AHSP grouping (site preparation, earthwork, foundations, concrete structure, walls, plastering, roofing, flooring, finishing, mechanical-electrical) as an editable default — so contractors don't start from nothing, but stay free to adapt it to their own habits.

#### Coefficient structure (phase 2+, not for the MVP)

If auto-pricing from the official AHSP/HSPK is added later, prepare a separate `work_item_component` table (work_item_id, type: material/labour/equipment, component name, component unit, coefficient) that stays empty in the MVP — the DB schema is ready without having to be used yet.

### Low-friction UX recommendations

1. **Mirror the Excel pattern they already know** — a table: No., Description, Category, Quantity, Unit, Unit Price, Subtotal. Don't reinvent the UI; small contractors are already used to this format from the widely circulated Excel templates — a similar UI means the learning friction is near zero.
2. **Live auto-calculation**: as soon as a quantity/price is entered, the per-item subtotal, the per-category rollup, and the project total update automatically. Remove any need for them to write or remember formulas themselves.
3. **A personal work-item catalogue**: once a contractor enters a type of work, offer to save it to "my work items" — the next project is a search/select, not retyping from scratch.
4. **Built-in starter categories, but editable**: provide a list of common SNI/AHSP-style categories as a default, not a requirement.
5. **Phone-friendly design**: many contractors work on site, not at a laptop. The input form should be comfortable to fill in on a phone.
6. **Export to the formats they already use**: a tidy PDF (and ideally Excel) to hand to the client.
7. **Hide the technical terms, not the concepts**: label things in the UI using the language contractors already know from manual RABs — don't force them to learn new terms like "assembly" or "provisional sum".
8. **A simplified RAB maturity status**: just two states — "Preliminary estimate" vs "Final RAB".
9. **Progressive disclosure for future phases**: lay the UI out so that when phase 2 adds auto-pricing it can just "slot in" without a total redesign.

### Assumptions to validate with contractors

This research explains the standards & common practice, but it isn't a substitute for direct interviews. The following claims/assumptions should be checked with real small contractors before becoming final design decisions:

1. **The tool they use today** — is it really still manual Excel, or have some moved to similar software (RAB Otomatis or another)?
2. **Real overhead & profit figures** — the ~10% assumption from secondary references isn't confirmed from the official text of Permen 8/2023, and most likely varies per contractor/project type/region.
3. **The relevance of standard SNI/AHSP categories** — do contractors actually need this formal grouping?
4. **How often the official HSPK/AHSP is genuinely used** for small private projects.
5. **The device used to produce an RAB** — phone, laptop, or both.
6. **The format currently given to the client** — PDF, print, Excel, or a photo/WhatsApp.
7. **How much detail each line description needs** — a short name vs a detailed description/material spec.
8. **The value of a reusable item catalogue** — is it genuinely seen as useful, or is every project considered unique?
9. **The typical scale of one RAB** — how many lines/items per project on average.
10. **Familiarity with quantities & units** — are m²/m³/OH/lump sum already understood naturally?

A short interview (15-20 minutes) focused on points #1, #2, #5, #6, and #8 has the most direct bearing on the next MVP design decisions.
