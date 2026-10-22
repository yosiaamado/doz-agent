# Indonesian Regulations Snapshot

> **Status: a snapshot, not the source of truth.** Researched 22 October 2026. Tax rules and accounting standards change almost every year. Before using anything here in a spec, **re-verify it** against primary sources (see the research protocol in `SKILL.md` §4), then update the date in this file.
>
> Most sources below are professional/secondary. Only those marked **[primary]** come directly from a regulator or standard setter.

## 1. Accounting standards (SAK)

### Framework by entity type

| Framework | For | Notes |
|---|---|---|
| **SAK Indonesia** (IFRS-based) | Publicly accountable entities (listed companies, banks, insurers) | New PSAK numbering since 2024 (below) |
| **SAK EP** (Private Entities) | Entities without public accountability that publish financial statements for external users | **Effective 1 January 2025**, replacing SAK ETAP. Adopted from IFRS for SMEs with Indonesian adjustments |
| **SAK EMKM** | Micro, small and medium enterprises | The simplest |
| **Sharia SAK** | Sharia transactions | PSAK 400 series |

Sources: [IAI — SAK EP approved](https://web.iaiglobal.or.id/SAK-IAI/Produk%20SAK%20Entitas%20Privat%20Disahkan) **[primary]**, [DDTC](https://news.ddtc.co.id/berita/nasional/1801610/sak-etap-diganti-sak-ep-kebijakan-baru-akuntansi-koperasi-dirilis), [Mekari Jurnal](https://www.jurnal.id/id/blog/sak-ep/)

### PSAK renumbering since 1 January 2024

The renumbering **changed numbers only, not content**. Three digits, where the first digit means:

| Series | Based on |
|---|---|
| 1xx | IFRS |
| 2xx | IAS |
| 3xx | Indonesian local standards |
| 4xx | Sharia |

The mappings engineers meet most often:

| Old | New | Topic |
|---|---|---|
| PSAK 71 | **PSAK 109** | Financial instruments (effective interest method, expected credit losses) |
| PSAK 72 | **PSAK 115** | Revenue from contracts with customers |
| PSAK 73 | **PSAK 116** | Leases |
| PSAK 1 | **PSAK 201** | Presentation of financial statements (to be replaced by PSAK 118) |
| PSAK 24 | **PSAK 219** | Employee benefits |
| PSAK 109 (old) | **PSAK 409** | Zakat and infaq/sadaqah accounting |

⚠ **Trap:** "PSAK 109" in an old document means zakat; in a new document it means financial instruments. Always check the document's year.

Sources: [IAI — PSAK/ISAK renumbering (PDF)](https://web.iaiglobal.or.id/assets/files/file_publikasi/Perubahan_Penomoran_PSAK_ISAK_dalam_SAK_Indonesia.pdf) **[primary]**, [DDTC](https://news.ddtc.co.id/berita/nasional/1805408/jangan-lupa-ada-perubahan-penomoran-psak-begini-ketentuannya), [Binus Accounting](https://accounting.binus.ac.id/2024/11/24/perubahan-penomoran-psak-dan-isak-dalam-standar-akuntansi-keuangan-2-dari-2/)

### PSAK 118 — Presentation and Disclosure (IFRS 18 adoption)

- Approved by DSAK IAI on 28 May 2025, **effective 1 January 2027**, replacing PSAK 201. Early application permitted.
- Profit or loss is grouped into 5 categories: **operating, investing, financing, income tax, discontinued operations**, with required subtotals such as operating profit.
- **System implication:** every income/expense account needs a PSAK 118 category attribute. If you design a chart of accounts now, add it from the start.

Source: [IAI — PSAK 118 approved](https://web.iaiglobal.or.id/Berita-IAI/detail/pengesahan_psak_118_penyajian_dan_pengungkapan_dalam_laporan_keuangan) **[primary]**

## 2. PPN (VAT)

### 12% rate with an "other value" tax base (PMK 131/2024)

| Supply | Formula | Effective rate |
|---|---|---|
| **Luxury goods** (subject to PPnBM) | 12% × selling price | 12% (fully applied to end-consumer sales from 1 February 2025) |
| **Everything else** | 12% × (11/12 × selling price) | **11%** |

Example: a non-luxury item at Rp 1,000,000 → PPN = 12% × 11/12 × 1,000,000 = **Rp 110,000**.

**System implication:** never store "VAT rate = 11%". Store the **nominal rate** and the **tax-base factor** separately, both with effective dates, because the tax invoice shows the other-value tax base.

Sources: [DJP — PMK 131/2024](https://www.pajak.go.id/en/node/113440) **[primary]**, [Ortax](https://ortax.org/resmi-pmk-131-2024-atur-ppn-12-persen-hanya-untuk-barang-mewah), [OnlinePajak](https://www.online-pajak.com/seputar-ppn-efaktur/pmk-131-tahun-2024-dan-cara-hitung-ppn-12-persen/)

### Coretax and tax invoices

- Tax invoices are created and approved in **DJP Coretax**. The tax invoice serial number (NSFP) is assigned automatically by the system; it is no longer requested through e-Nofa.
- **PER-11/PJ/2025:** the NSFP is now **17 digits**. Secondary sources **disagree** on how the digits break down. Check the regulation text before validating the number format.
- There are 10 transaction codes (01–10). Codes 06 and 07 can't be issued from e-Faktur Desktop.

**System implication:** don't write an NSFP regex from an article. Store it as a 17-character string and treat it as **data issued by DJP**, not a number the system generates.

Sources: [IKPI](https://ikpi.or.id/en/format-baru-nsfp-era-coretax-kini-17-digit-dan-diberikan-otomatis/), [Pajak.com](https://www.pajak.com/pajak/perhatikan-perubahan-kode-dan-format-nomor-seri-faktur-pajak-di-coretax-sesuai-per-11-2025/), [Accurate](https://accurate.id/ekonomi-keuangan/kode-faktur-pajak-di-coretax/)

## 3. PPh (income tax)

### PPh 21 (employee withholding) — Average Effective Rate (TER)

- Basis: **PP 58/2023**, implemented by **PMK 168/2023**, effective January 2024.
- January–November: **PPh 21 = monthly TER × monthly gross income**. December (or the final month of employment): recalculated with the annual art. 17 rates, minus what was already withheld.
- TER category by PTKP (marital/dependents) status:

| Category | PTKP status |
|---|---|
| A | TK/0, TK/1, K/0 |
| B | TK/2, TK/3, K/1, K/2 |
| C | K/3 |

- Example: category A, gross Rp 7,000,000, TER 1.25% → PPh 21 = **Rp 87,500**.
- ⚠ Secondary sources differ on the bracket details of the TER table. **Take the table from the PMK 168/2023 annex on pajak.go.id**, not from articles.

**System implication:** store the TER table as data (category, lower bound, upper bound, rate, effective date), not `if/else` in code.

Sources: [DJP — PMK 168/2023 (PDF)](https://pajak.go.id/sites/default/files/2024-02/PMK%20168%20Tahun%202023%20Tentang%20PPh%20Pasal%2021%20TER.pdf) **[primary]**, [IAI — PPh 21 rules (PDF)](https://web.iaiglobal.or.id/assets/files/file_publikasi/20240124_PP%2058%20Tahun%202023_IAI_Rev.pdf), [OnlinePajak](https://www.online-pajak.com/tentang-pph21/tarif-ter-pph-21/)

### Final 0.5% MSME income tax

- Originally **PP 55/2022**, amended by **PP 20/2026**.
- Gross turnover threshold **Rp 4.8 billion** per year.
- Per DJP: **individuals and sole-proprietor PTs (PT perorangan) can use this rate with no time limit**. Cooperatives: at most 4 years from registration.
- PP 20/2026 also tightened eligibility (certain professions, business splitting), and turnover counts all business revenue.

**System implication:** "may use final MSME tax" depends on taxpayer type, registration date and year-to-date turnover. Store it as an evaluated rule, not an undated manual flag.

Sources: [DJP — new era of final MSME tax](https://www.pajak.go.id/en/node/119953) **[primary]**, [DDTC](https://news.ddtc.co.id/berita/nasional/1819741/akhirnya-aturan-baru-soal-pph-final-umkm-05-persen-resmi-terbit), [IKPI](https://ikpi.or.id/en/pp-20-tahun-2026-akhir-era-pph-final-umkm-berbasis-batas-waktu/)

## 4. Record retention

- **UU KUP art. 28(11):** books, records, source documents and electronically processed data **must be kept for 10 years in Indonesia**.
- Law 8/1997 on Company Documents also sets a 10-year retention period.

**System implication:** no automatic cleanup job may delete transaction data or attachments younger than 10 years. Consider where data is stored (in Indonesia) when choosing cloud infrastructure.

Sources: [DDTC](https://news.ddtc.co.id/berita/nasional/1805429/alasan-dokumen-dasar-pembukuan-wajib-disimpan-selama-10-tahun), [DJP](https://pajak.go.id/en/node/111435) **[primary]**

## 5. Not yet researched (research before a feature touches these)

- PPh 23 and PPh 4(2): rates per service/object type.
- Fiscal depreciation groups and rates (Income Tax Law art. 11 after the HPP Law).
- Stamp duty (amount and document thresholds).
- Official PPN and PPh rounding rules in Coretax.
- e-Bupot obligations, current payment and filing deadlines.
- Regional taxes (restaurant/hotel/parking PBJT), which differ per region.
- OJK/BI rules if the product touches payments, e-wallets or lending.

## Update history

| Date | Change |
|---|---|
| 2026-10-22 | Initial snapshot: SAK EP, PSAK renumbering, PSAK 118, PPN PMK 131/2024, Coretax NSFP, PPh 21 TER, final MSME tax PP 20/2026, 10-year retention |
