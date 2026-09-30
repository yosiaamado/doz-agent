# RAB Generator — Research on International Standards & Methods

A reference for the `rab-kontraktor-advisor` skill. The product context and usage rules are in `SKILL.md`.

## Part 2: International standards & methods

### BOQ (Bill of Quantities)

A [BOQ](https://www.designingbuildings.co.uk/wiki/Bill_of_quantities_BOQ) is a document listing the measured quantities of work items identified from **completed** design drawings and specifications — unlike the Indonesian RAB, which is sometimes drawn up in parallel with a design that isn't 100% final. It's produced by a dedicated profession, the **Quantity Surveyor (QS)/cost consultant**, which has no formal equivalent in Indonesia (the role is usually absorbed by the architect/contractor/in-house estimator).

#### Line structure

Every BOQ line (following the [NRM2](https://takeoff.alvesrowe.com/guides/what-is-an-nrm2-bill-of-quantities) rules) contains: **Reference/code**, **Description**, **Unit**, **Quantity**, **Rate** (filled in by the contractor when bidding), **Amount** (qty × rate). This is structurally almost identical to the Indonesian RAB (No., Description, Quantity, Unit, Unit Price, Total) — the difference being that a BOQ always has an explicit standard reference-code column.

Units of measurement: `nr` (count), `m` (linear), `m²` (area), `m³` (volume), `t`/`kg` (weight), `item` (lump sum), `%` — very similar to the Indonesian AHSP units (OH, m², m³, kg, lump sum), but more standardised across projects through explicit *measurement rules* that ensure "two estimators measuring the same drawings produce bills that compare line by line."

#### Measurement standards: from SMM7 to NRM

The UK used to use **SMM7** (Standard Method of Measurement, 7th edition), replaced since 2013 by the [RICS New Rules of Measurement (NRM)](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm), in 3 volumes:

- **NRM1** — Order of Cost Estimating and Cost Planning for Capital Building Works (early-stage estimating)
- **NRM2** — Detailed Measurement for Building Works (detailed BOQ measurement rules for tender)
- **NRM3** — Order of Cost Estimating and Cost Planning for Building Maintenance Works (maintenance/whole-life-cycle costs, integrated with BIM/ISO 19650)

#### Its function in a tender

A BOQ ensures every contractor bids against the same quantities (standardisation & fairness), provides the basis for comparing bids, and the *priced BOQ* becomes the basis of the contract + the assessment of interim payments.

#### Concepts with no Indonesian RAB equivalent

A [provisional sum](https://www.designingbuildings.co.uk/wiki/Provisional_sum) — a contingency/estimate for items not yet defined in detail at tender (*defined* vs *undefined*); a **prime cost sum** — an allowance for work/materials from a subcontractor/supplier nominated by the client rather than the main contractor; **preliminaries** — the setup and project-management overhead, usually separated as its own bill up front (not a flat percentage on each item, as overhead & profit is in AHSP). All three are explicit in a BOQ but not formalised in a small Indonesian contractor's RAB — Indonesian RABs tend to be "all-in" per item, rarely with an explicit slot for "not yet certain".

### AACE International — Cost Estimate Classification

AACE International (Association for the Advancement of Cost Engineering) publishes [Recommended Practice 18R-97](https://web.aacei.org/docs/default-source/toc/toc_18r-97.pdf) — a 5-class cost-estimate classification system based on the maturity of the project definition. It originated in process/EPC industries, but the concept is widely adopted across construction sectors because its philosophy is universal: **the more mature the design, the narrower the accuracy range you can realistically claim**.

| Class | Project definition level | Accuracy range (low/high) | Methodology | Use |
| --- | --- | --- | --- | --- |
| Class 5 | 0–2% | -20% to -50% / +30% to +100% | Parametric models, judgment, analogy | Feasibility studies, early concept screening |
| Class 4 | 1–15% | -15% to -30% / +20% to +50% | Equipment factored/parametric models | Preliminary budget approval |
| Class 3 | 10–40% | -10% to -20% / +10% to +30% | Semi-detailed unit costs, assembly-level items | Detailed design, funding approval |
| Class 2 | 30–75% | -5% to -15% / +5% to +20% | Detailed unit costs, detailed take-off required | Construction planning, tender |
| Class 1 | 65–100% | -3% to -10% / +3% to +15% | Detailed unit costs, full take-off | Estimate verification, execution control |

#### The insight worth adopting (not the whole system)

AACE forces the user to be explicit about **how mature** the estimate is — not just a single number with no confidence context. Indonesia's AHSP/HSPK/RAB has no explicit equivalent: an RAB is usually treated as a "definite" figure once produced, even though its maturity level can vary enormously (a rough RAB for an initial quote versus a contract-ready final RAB after every price has been confirmed).

For the MVP: something simple like **a status/tag on the RAB itself** ("Preliminary estimate" vs "Final RAB") — not a complex 5-class system — could be a small differentiator inspired by the AACE concept, and helps the contractor communicate to the client how reliable the figure they're giving at a particular stage really is.

### Modern cost-estimation software

Surveyed via two representative examples: [Buildxact](https://www.buildxact.com/us/blog/builders-estimating-software/) (focused on small-to-medium residential builders) and [JobTread](https://www.jobtread.com/features/cost-catalog) (focused on the cost catalog/estimating workflow). Both show the same data structure pattern, though their terminology differs:

#### Four consistent data layers

1. **Cost items** — the most basic individual cost items: materials, labour rates, subcontractor costs, permits, insurance, overhead. The direct equivalent of "materials/labour/equipment" in AHSP.
2. **Cost groups / assemblies** — a group of cost items frequently used together as one "work package" (e.g. an assembly for "lay 1 m² of brick wall" = bricks + cement + sand + craftsman labour). **This is conceptually identical to AHSP** — an assembly is the international version of an AHSP item. The important insight: what the Indonesian government mandates through regulation (Permen PUPR) is, in international software, left to *a library curated by each company/software vendor* themselves.
3. **Budget/project templates** — ready-made project outlines for repeat work (kitchen renovation, swimming pool, deck) so nobody is "rebuilding estimates from scratch" on every new project — the digital equivalent of the "RAB Excel template" Indonesian contractors already use by hand (see the Practice in the Field section in [standar-indonesia.md](standar-indonesia.md)).
4. **Task & schedule templates** — pre-built schedules attached to a project — outside the scope of a pure RAB, more project management (relevant for a later product phase, not the MVP).

#### The UX approach worth adopting (not the raw features)

- **A connected workflow, not double entry**: "measurements taken from plans automatically flow into material lists and costs" — the principle: once a quantity is entered in one place, every derived calculation (cost per item, category subtotal, project total) updates automatically without the user re-entering it elsewhere. This is a UX principle that's cheap to apply in the MVP with no AI/live pricing needed.
- **A reusable library owned by the contractor**: the cost catalog and assemblies are stored per account/company and reused across projects — even with prices entered manually per project in the MVP, contractors still benefit if the *list of work items* (not the prices) can be saved and reused, so each new RAB gets faster over time.
- **Live pricing integration** (pulling real-time prices from suppliers) and **automated digital takeoff** (measuring automatically from a digital drawing) are advanced features explicitly outside the MVP scope (manual prices per project) — but worth knowing as a realistic direction if the product grows, rather than something to copy now.
- **An AI assistant for material suggestions/validation** (Buildxact's "Blu" feature) — also outside the MVP, but it shows the industry trend: help a novice user with intelligent suggestions rather than handing them an empty form.
