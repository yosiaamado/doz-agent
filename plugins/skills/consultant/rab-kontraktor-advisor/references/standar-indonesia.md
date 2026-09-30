# RAB Generator — Research on Indonesian RAB Standards

A reference for the `rab-kontraktor-advisor` skill. The product context and usage rules are in `SKILL.md`.

## Part 1: Indonesian RAB standards

### AHSP (Analisa Harga Satuan Pekerjaan — unit-price analysis of work items)

AHSP is a list of **coefficients** for the labour, materials, and equipment needed to produce **1 unit of work** (e.g. 1 m² of brickwork, 1 m³ of concrete, 10 kg of rebar). AHSP contains no rupiah figures — only the quantities required per unit of work. The rupiah prices come from a separate source (HSD/HSPK, covered in the next section).

**Current legal basis**: [Permen PUPR No. 8 Tahun 2023](https://peraturan.bpk.go.id/Details/262345/permen-pupr-no-8-tahun-2023) (a Ministry of Public Works regulation) on Guidelines for Preparing Cost Estimates for Construction Work in the Public Works sector (enacted 30 August 2023). It revokes and replaces Permen PUPR No. 1 Tahun 2022, which had previously replaced [Permen PU No. 28 Tahun 2016](https://sibangkoman.pu.go.id/center/pelatihan/uploads/edok/2019/04/cc5d5_Lamp_Permen_PUPR_28-2016_-_AHSP_bidang_Umum-SDA-Cipta_Karya-Bina_Marga_-_Copy.pdf) — so this is a continuously updated line of regulation, not a static rule. Its scope: general works, water resources, highways, and human settlements & housing.

#### Coefficient structure

Every AHSP item has 3 components:

1. **Labour (A)** — in OH (*Orang-Hari*, man-days): foreman, head craftsman, craftsman, worker
2. **Materials (B)** — in material units: kg, m³, sacks, pieces, sheets, etc.
3. **Equipment (C)** — in hours/days of equipment use

The general formula, used consistently across various training/tutorial references:

```latex
D = A + B + C
Harga\ Satuan\ Pekerjaan = D + E
```

where E is the contractor's overhead & profit. Note: several secondary references say E is often assumed to be around 10%, but this figure isn't confirmed directly from the text of Permen 8/2023 — it needs re-checking, and in the field it's frequently the contractor's own call anyway (it goes on the list of assumptions to validate).

#### Concrete examples

| Work item | Coefficients | Source |
| --- | --- | --- |
| Laying 1 m² of red brick | 0.400 OH worker + 0.200 OH craftsman + 143.81 bricks + 43.5 kg cement + 0.08 m³ sand | [kelasteknik.id](https://kelasteknik.id/tips/bank-ahsp-estimasi-biaya) |
| 10 kg of rebar work | Labour Rp 27,460 + Materials Rp 140,625 + Equipment Rp 0 → subtotal Rp 168,085, +10% OH&P → Rp 184,894 (≈Rp 18,489/kg) | [Rumah Material](https://www.rumahmaterial.com/2023/01/analisa-harga-satuan-pembesian-SNI.html) |

The important implication for the product: AHSP is **a coefficient template reusable across projects and across regions** (the numbers are technically fairly stable), whereas the basic unit prices (wage per OH, material price per unit) are what vary by location and over time. That's a strong reason to separate these two data layers in the database schema — discussed further in the Data Structure Recommendations ([rekomendasi.md](rekomendasi.md)).

### HSPK (Harga Satuan Pokok Kegiatan — standard unit prices per activity)

HSPK is a list of **unit prices** (in rupiah) for building materials and labour that apply in a given region — published by the provincial or regency/city Public Works Department / Construction Services Office, usually via a Regent's/Mayor's/Governor's Regulation or a departmental decree, **once a year** (sometimes revised mid-year if prices move significantly).

A real example: the [Central Java Provincial Construction Services Office (MASPETRUK)](https://maspetruk.dpubinmarcipka.jatengprov.go.id/harga_satuan/hspk) publishes HSPK for 35 regencies/cities, the latest being "Edisi I Tahun 2026" — one edition per year, different per region. An example of regency-level regulation: [Perbup Lima Puluh Kota No. 69 Tahun 2022 on HSPK](https://jdih.limapuluhkotakab.go.id/peraturan/detail/db854aa7-084a-4e08-8d63-a48699b8de8f).

#### Structure & relationship to AHSP

- **HSD (Harga Satuan Dasar — basic unit prices)** = building material prices from a local market survey + labour wages based on the local minimum wage (UMK/UMR), divided by working days
- **HSPK** = AHSP (requirement coefficients) × local HSD, + overhead & profit → the end result is a ready-to-use "price per unit of work", specific to one region

So AHSP is a **relatively stable national coefficient**, while HSD/HSPK are **local prices that change yearly and differ per region** — two variables that must be separated in the product's data model.

#### Why it differs by region

- Material prices are affected by distance from the source/port and transport/logistics costs
- Labour wages follow the regency/city minimum wage (UMK/UMR), which differs legally — the gap between a large city and a remote area can be significant

#### How small contractors usually get this data

1. Downloading the PDF/Excel straight from the provincial Public Works / Construction Services site — but not every province/regency has a tidy, up-to-date digital portal (Central Java is one of the better ones)
2. Surveying prices themselves at local material shops and with local craftsmen — the most common route for private projects, since using the official HSPK isn't mandatory
3. Instinct/experience from previous projects, adjusted for recent price rises
4. Paid local RAB software with a monthly price database already embedded (covered in the Practice in the Field section)

**Implication for the MVP**: the official HSPK is mandatory as the basis for government projects' owner's estimates, but for small private contractors (this product's target user) it's usually just a *rough reference* — real field prices, especially daily/lump-sum craftsman rates, often diverge from the official figures. That reinforces the MVP decision of "unit prices entered manually per project" — it matches reality closely, rather than being merely a technical simplification.

### SNI for calculating work quantities

One thing to clear up first: the SNI family below is titled "Procedures for Calculating the **Unit Price** of Work" — its contents are actually the technical methodology for deriving AHSP coefficients per work category (functionally similar to the Permen PUPR AHSP, and indeed one of the technical references behind it), not rules for "how to measure quantities from a drawing" (length × width × height), which is general engineering mathematics and has no dedicated SNI in Indonesia — unlike the international RICS/NRM approach, which does have explicit *measurement rules* (covered in the BOQ section of [standar-internasional.md](standar-internasional.md)).

#### The SNI "Procedures for Calculating the Unit Price of Work" series (BSN, 2008)

| SNI | Work category |
| --- | --- |
| [SNI 2835:2008](https://www.slideshare.net/slideshow/sni-28352008tata-cara-perhitungan-harga-satuan-pekerjaan-tanah-untuk-konstruksi-bangunan-gedung-dan-perumahan/69938964) | Earthwork |
| [SNI 2836:2008](https://www.slideshare.net/slideshow/sni-28362008tata-cara-perhitungan-harga-satuan-pekerjaan-pondasi-untuk-konstruksi-bangunan-gedung-dan-perumahan/69939015) | Foundation work |
| [SNI 2837:2008](https://www.slideshare.net/slideshow/sni-28372008tata-cara-perhitungan-harga-satuan-pekerjaan-plesteran-untuk-konstruksi-bangunan-gedung-dan-perumamahan/69939038) | Plastering |
| [SNI 2839:2008](https://www.slideshare.net/slideshow/sni-28392008tata-cara-perhitungan-harga-satuan-pekerjaan-langitlangit-untuk-konstruksi-bangunan-gedung-dan-perumahan/69939057) | Ceiling work |
| [SNI 3434:2008](https://www.slideshare.net/slideshow/sni-34342008tata-cara-perhitungan-harga-satuan-pekerjaan-kayu-untuk-bangunan-gedung-dan-perumahan/69939078) | Timber work |
| [SNI 6897:2008](https://katalog.kemdikbud.go.id/index.php?p=show_detail&id=91585) | Wall work |
| [SNI 7393:2008](https://slideshare.net/EllanSyahnoorizalSir/sni-73932008tata-cara-perhitungan-harga-satuan-pekerjaan-besi-dan-aluminium-untuk-konstruksi-bangunan-gedung-dan-perumahan) | Steel and aluminium work |
| [SNI 7394:2008](https://klinikkonstruksi.jogjaprov.go.id/storage/images/peraturan/SNI%207394-2008%20-%20Tata%20Cara%20Perhit%20Harga%20Sat%20Pek%20Beton%20utk%20konstruksi%20BG%20&%20Rmh.pdf) | Concrete work |
| [SNI 7395:2008](https://www.slideshare.net/slideshow/sni-73952008tata-cara-perhitungan-harga-satuan-pekerjaan-penutup-lantai-dan-dinding-untuk-konstruksi-bangunan-gedung-dan-perumahan/69938886) | Floor and wall finishes |

All were published in 2008 and are consistently titled "...for the Construction of Buildings and Housing" — precisely relevant to the small-contractor scale (houses, small shop-houses, renovations), not large infrastructure.

#### A different SNI category: structural design standards

[SNI 2847:2019 — Structural Concrete Requirements for Buildings](https://tekonsipil.sv.ugm.ac.id/wp-content/uploads/sites/938/2020/01/SNI-2847-2019-Persyaratan-Beton-Struktural-Untuk-Bangunan-Gedung-1.pdf) is a different category altogether — a **structural safety design** standard (concrete strength, reinforcement, etc., functionally similar to ACI 318 in the US), used by structural engineers while designing, not for calculating an RAB. Don't conflate it with SNI 7394:2008 above.

**Implication for the MVP**: since there's no standard SNI for "how to measure quantities from working drawings", quantities in this product should remain **manual input from the contractor** (they measure from the drawings/site themselves) — the product just needs to provide a quantity field + units consistent with the AHSP/SNI units above (m², m³, kg, OH, lump sum), rather than trying to compute them automatically from a drawing (that's CAD/BIM take-off territory, outside the MVP).

### How small contractors actually work in the field

Based on a survey of the most widely circulated blogs/tutorials for an Indonesian audience ([beginisob.com](https://www.beginisob.com/2025/12/cara-membuat-rab-bangunan-di-excel.html), [Asia Arsitek](https://asiaarsitek.com/cara-membuat-rab-rumah-excel/), [Kledo](https://kledo.com/blog/contoh-rab/)), a consistent pattern emerges:

1. **Manual Excel** with a standard column structure: No., Category, Work Description, Quantity, Unit, Unit Price, Subtotal, Notes. The core formula: `Subtotal = Quantity × Unit Price`, subtotalled per category with `SUMIFS`.
2. **Free templates** circulate widely across architecture/construction blogs — the search volume and the number of sites offering "free RAB Excel template download" indicate high demand, but no single format has become the dominant standard.
3. **Mixed sources for unit prices**: "common" items (brickwork, plastering, etc.) often reference the government AHSP/HSPK; highly local/volatile items (daily craftsman rates, current material prices) are filled in from the contractor's own instinct/experience.
4. **A local competitor already exists**: [RAB Otomatis](https://rabotomatis.com/) — Indonesian desktop software, one-off purchase model (≈Rp 140k, discounted from Rp 240k), embedding the official Cipta Karya AHSP database (referencing SE DJBK No. 47/2026) + monthly material price updates. Its explicit target: "small-to-medium contractors, builders, architects", claiming "beginners who don't know the formulas by heart" can use it. This is a direct competitor that has already solved the "AHSP database + ready-made prices" part — precisely the part the MVP deliberately leaves out (manual prices per project).
5. There's also RAB software focused on government tender projects ([daksasoft](http://www.daksasoft.co.id/konstruksi/) — LPSE, S-curves, time schedules) — a different target from small private contractors.

**An honest note on the limits of this research**: no open forum threads (Kaskus, Facebook groups, Reddit) were found specifically discussing small contractors' complaints about the RAB process — most search results are SEO blog articles from architecture/software vendors, not genuine discussion from contractors themselves. Qualitative insight into their *real frustrations* with manual Excel (where mistakes happen most, what eats the most time) is far more valuable than these articles — a strong reason to prioritise direct interviews with contractors the user already knows (see the Assumptions section in [rekomendasi.md](rekomendasi.md)).
