---
name: "rab-kontraktor-advisor"
description: "Use when discussing feature, priority, or data-model/UX decisions for the Indonesian small-contractor RAB generator product, or when AHSP/HSPK/SNI vs BOQ/AACE construction-costing standards are relevant."
---

# RAB Generator — Product Context & Consulting Guide

## Your role (Claude)

The user is a solo technical founder building a digital RAB (*Rencana Anggaran Biaya*, the Indonesian construction cost estimate/budget document) tool for small contractors in Indonesia. The first thing being built: an MVP RAB generator, where the contractor enters material/labour unit prices by hand per project (no automatic updates from the system yet).

When the user asks about features, priorities, or the next technical decision for this product:

- Answer while weighing the research & recommendations in this skill and in `references/` (the Indonesian AHSP/HSPK/SNI standards, the international BOQ/AACE standards, and modern software practice such as Buildxact/JobTread).
- Proactively flag a relevant standard or practice the user hasn't mentioned — that's the main value this skill adds.
- Remember the MVP decisions already made: manual unit prices per project, no auto-pricing yet. Don't propose features that assume automatic price integration/live pricing unless the user explicitly wants to discuss phase 2+.
- Some claims in this research are still marked "an assumption not yet validated with real contractors" (see the Assumptions section in [references/rekomendasi.md](references/rekomendasi.md)) — when using one as an argument, label it as an assumption; don't treat it as settled fact until the user confirms it has been validated.
- This research comes from web searches as of late September 2026 (Permen PUPR No. 8/2023, etc.) — if the user asks about something that may have changed (new regulation, new competitor), search again rather than assuming this research stays 100% accurate forever.

---

The research confirms that the MVP decision of "unit prices entered manually per project" already matches reality: both Indonesian regulation and how small contractors actually work separate "the technical requirements of the work" from "local market prices" — two things that genuinely belong apart, not something to collapse together.

**Key findings:**

- AHSP (*Analisa Harga Satuan Pekerjaan*, the official unit-price analysis standard — [Permen PUPR No. 8/2023](https://peraturan.bpk.go.id/Details/262345/permen-pupr-no-8-tahun-2023)) governs the material/labour/equipment coefficients per unit of work — not the rupiah prices.
- HSPK (*Harga Satuan Pokok Kegiatan*, published per region as a Perbup/Perwal — a regent's or mayor's regulation — and reissued annually) is what supplies the rupiah prices; it differs per region because local material prices and the local minimum wage (UMK/UMR) differ — and for small private projects it's usually a rough reference, not a binding one.
- The SNI (*Standar Nasional Indonesia*, the national standards) series on "procedures for calculating unit prices of work" (2835–7395:2008) forms the technical basis of AHSP per category (earthwork, foundations, concrete, walls, etc.) — but there is no standard SNI for how to measure quantities from drawings; that remains the contractor's manual expertise.
- Actual practice: most small contractors still use manual Excel (quantity × unit price, with per-category subtotals via SUMIFS); a local competitor already exists ([RAB Otomatis](https://rabotomatis.com/)) that embeds an AHSP database + monthly prices.
- Internationally (BOQ/RICS NRM), the structure is nearly identical (quantity × rate) but more formal: explicit measurement rules, quantity surveyor as a profession, and provisional sums for items that aren't settled.
- AACE has an estimate-maturity classification system (Class 1–5) with no explicit Indonesian equivalent — worth adopting in a simplified form.
- Modern software (Buildxact, JobTread) shows a 4-layer data pattern (cost items → assemblies/cost groups → project templates → schedule) — an assembly is essentially "the international version of AHSP".

**Main recommendations** (details in [references/rekomendasi.md](references/rekomendasi.md)):

1. Separate the "work item catalogue" (reusable) from "prices per project" (manual) from the very first data schema design, so auto-pricing can be added later without a big migration.
2. UX: mirror the Excel table pattern people already know, calculate live, and offer to save an item into a personal catalogue.
3. Validate with real contractors before building further — especially the real overhead/profit figures, the devices they use, and the export format (10 full points in the Assumptions section of [references/rekomendasi.md](references/rekomendasi.md)).

## References (read as needed)

The detailed research and its sources live in `references/`. Read only the file relevant to the question:

| File | Contents | Read it when |
|---|---|---|
| [references/rekomendasi.md](references/rekomendasi.md) | Indonesia vs international comparison, data structure recommendations (entities, the RAB formula, categories, coefficients in phase 2+), low-friction UX, and the assumptions that need validating | Deciding features, priorities, the data model, or UX |
| [references/standar-indonesia.md](references/standar-indonesia.md) | AHSP, HSPK, the SNI series, and how small contractors actually work | Questions about Indonesian standards/regulation or how contractors work today |
| [references/standar-internasional.md](references/standar-internasional.md) | BOQ/NRM, the AACE classification, and the data patterns of modern estimating software | Comparing against international practice or looking for a pattern worth adopting |
