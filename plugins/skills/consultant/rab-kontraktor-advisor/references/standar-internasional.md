# RAB Generator — Riset Standar & Metode Internasional

Referensi skill `rab-kontraktor-advisor`. Konteks produk dan aturan pakainya ada di `SKILL.md`.

## Bagian 2: Standar & Metode Internasional

### BOQ (Bill of Quantities)

[BOQ](https://www.designingbuildings.co.uk/wiki/Bill_of_quantities_BOQ) adalah dokumen berisi kuantitas terukur dari item-item pekerjaan yang diidentifikasi dari gambar dan spesifikasi desain yang **sudah selesai** — beda dari RAB Indonesia yang kadang disusun paralel dengan desain yang belum 100% final. Disusun oleh profesi khusus, **Quantity Surveyor (QS)/cost consultant**, yang di Indonesia belum punya padanan formal setara (peran ini biasanya dirangkap arsitek/kontraktor/estimator internal).

#### Struktur baris

Setiap baris BOQ (mengikuti aturan [NRM2](https://takeoff.alvesrowe.com/guides/what-is-an-nrm2-bill-of-quantities)) berisi: **Reference/code**, **Description**, **Unit**, **Quantity**, **Rate** (diisi kontraktor saat bidding), **Amount** (qty × rate). Ini hampir identik secara struktural dengan RAB Indonesia (No, Uraian, Volume, Satuan, Harga Satuan, Jumlah) — bedanya BOQ selalu punya kolom kode referensi standar yang eksplisit.

Unit pengukuran: `nr` (jumlah), `m` (linear), `m²` (luas), `m³` (volume), `t`/`kg` (berat), `item` (lumpsum), `%` — sangat mirip satuan AHSP Indonesia (OH, m², m³, kg, ls), tapi lebih terstandardisasi lintas proyek lewat *measurement rules* eksplisit yang memastikan "two estimators measuring the same drawings produce bills that compare line by line."

#### Standar pengukuran: dari SMM7 ke NRM

Dulu UK pakai **SMM7** (Standard Method of Measurement, edisi 7), sejak 2013 digantikan [RICS New Rules of Measurement (NRM)](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm), terdiri 3 volume:

- **NRM1** — Order of Cost Estimating and Cost Planning for Capital Building Works (estimasi tahap awal)
- **NRM2** — Detailed Measurement for Building Works (aturan detail pengukuran BOQ untuk tender)
- **NRM3** — Order of Cost Estimating and Cost Planning for Building Maintenance Works (biaya maintenance/whole-life-cycle, terintegrasi BIM/ISO 19650)

#### Fungsi dalam tender

BOQ memastikan semua kontraktor menawar atas kuantitas yang sama (standardisasi & fairness), jadi dasar perbandingan penawaran, dan *priced BOQ* menjadi dasar kontrak + penilaian pembayaran termin.

#### Konsep yang tidak ada padanannya di RAB Indonesia

[Provisional sum](https://www.designingbuildings.co.uk/wiki/Provisional_sum) — dana cadangan/estimasi untuk item yang belum terdefinisi detail saat tender (ada *defined* vs *undefined*); **prime cost sum** — alokasi untuk pekerjaan/material dari subkontraktor/supplier yang ditunjuk klien, bukan kontraktor utama; **preliminaries** — biaya pendahuluan/overhead setup & manajemen proyek, biasanya dipisah sebagai bill tersendiri di awal (bukan persentase flat di tiap item seperti overhead & profit di AHSP). Ketiga konsep ini eksplisit di BOQ tapi tidak formal di RAB kontraktor kecil Indonesia — RAB Indonesia cenderung "all-in" per item, jarang punya slot eksplisit untuk "belum pasti".

### AACE International — Cost Estimate Classification

AACE International (Association for the Advancement of Cost Engineering) menerbitkan [Recommended Practice 18R-97](https://web.aacei.org/docs/default-source/toc/toc_18r-97.pdf) — sistem klasifikasi 5 kelas estimasi biaya berdasarkan tingkat kematangan definisi proyek. Awalnya untuk industri proses/EPC, tapi konsepnya diadopsi luas di banyak sektor konstruksi karena filosofinya universal: **makin matang desain, makin sempit rentang akurasi yang realistis untuk diklaim**.

| Kelas | Level definisi proyek | Rentang akurasi (low/high) | Metodologi | Kegunaan |
| --- | --- | --- | --- | --- |
| Class 5 | 0–2% | -20% s/d -50% / +30% s/d +100% | Model parametrik, judgment, analogi | Studi kelayakan, penyaringan konsep awal |
| Class 4 | 1–15% | -15% s/d -30% / +20% s/d +50% | Model faktoral peralatan/parametrik | Persetujuan anggaran pendahuluan |
| Class 3 | 10–40% | -10% s/d -20% / +10% s/d +30% | Biaya unit semi-detail, item level assembly | Desain terperinci, persetujuan pendanaan |
| Class 2 | 30–75% | -5% s/d -15% / +5% s/d +20% | Biaya unit detail, take-off wajib mendetail | Perencanaan konstruksi, tender |
| Class 1 | 65–100% | -3% s/d -10% / +3% s/d +15% | Biaya unit detail, take-off menyeluruh | Verifikasi estimasi, kontrol pelaksanaan |

#### Insight yang bisa diadopsi (bukan seluruh sistemnya)

AACE memaksa pengguna eksplisit soal **seberapa matang** estimasi itu — bukan cuma satu angka tunggal tanpa konteks kepercayaan. AHSP/HSPK/RAB Indonesia tidak punya konsep setara ini secara eksplisit: RAB biasanya diperlakukan sebagai angka "pasti" begitu disusun, padahal level kematangannya bisa sangat berbeda (RAB kasar untuk penawaran awal vs RAB final siap-kontrak setelah semua harga dikonfirmasi).

Untuk MVP: fitur sederhana seperti **status/tag pada level RAB** ("Estimasi Awal" vs "RAB Final") — bukan sistem 5-kelas yang rumit — bisa jadi diferensiator kecil yang terinspirasi konsep AACE ini, dan membantu kontraktor mengomunikasikan ke klien seberapa bisa diandalkan angka yang mereka kasih di tahap tertentu.

### Software Cost-Estimation Modern

Ditelusuri lewat dua contoh representatif: [Buildxact](https://www.buildxact.com/us/blog/builders-estimating-software/) (fokus residential builder kecil-menengah) dan [JobTread](https://www.jobtread.com/features/cost-catalog) (fokus cost catalog/estimating workflow). Keduanya menunjukkan pola struktur data yang sama, meski istilahnya beda-beda:

#### Empat lapis struktur data yang konsisten

1. **Cost items** — item biaya individual paling dasar: material, tarif tenaga kerja, biaya subkontraktor, izin, asuransi, overhead. Ini padanan langsung dari "bahan/upah/alat" di AHSP.
2. **Cost groups / assemblies** — kelompok cost items yang sering dipakai bersama jadi satu "paket pekerjaan" (misal: assembly "pasang 1 m² dinding bata" = kombinasi bata + semen + pasir + upah tukang). **Ini konsepnya identik dengan AHSP** — assembly = versi internasional dari item AHSP. Insight penting: apa yang di Indonesia diatur pemerintah lewat regulasi (Permen PUPR), di software internasional dibiarkan jadi *library yang dikurasi tiap perusahaan/tiap software vendor* sendiri.
3. **Budget/project templates** — rancangan proyek siap pakai untuk pekerjaan berulang (renovasi dapur, kolam renang, dek) supaya tidak "rebuilding estimates from scratch" tiap proyek baru — padanan digital dari "template RAB Excel" yang sudah dipakai kontraktor Indonesia secara manual (lihat bagian Praktik Lapangan di [standar-indonesia.md](standar-indonesia.md)).
4. **Task & schedule templates** — jadwal pra-buat yang ditempel ke proyek — di luar scope RAB murni, lebih ke project management (relevan untuk fase produk selanjutnya, bukan MVP).

#### Pendekatan UX yang bisa diadopsi (bukan fitur mentahnya)

- **Alur kerja tersambung, bukan entry ganda**: "measurements taken from plans automatically flow into material lists and costs" — prinsipnya: begitu volume diisi sekali di satu tempat, semua perhitungan turunan (biaya per item, subtotal kategori, total proyek) ikut update otomatis tanpa user harus input ulang di tempat lain. Ini prinsip UX yang murah diterapkan di MVP tanpa butuh AI/live pricing.
- **Reusable library milik kontraktor sendiri**: cost catalog dan assemblies disimpan per-akun/perusahaan dan dipakai ulang lintas proyek — walau harga di MVP diisi manual per proyek, kontraktor tetap bisa diuntungkan kalau *daftar item pekerjaan* (bukan harganya) bisa disimpan & dipakai ulang, supaya makin lama makin cepat bikin RAB baru.
- **Live pricing integration** (tarik harga real-time dari supplier) dan **automated digital takeoff** (ukur otomatis dari gambar digital) itu fitur canggih yang eksplisit di luar scope MVP (harga manual per proyek) — tapi bagus untuk tahu ini arah lanjutan yang realistis kalau produk berkembang, bukan sesuatu yang harus ditiru sekarang.
- **AI assistant untuk saran material/validasi** (fitur "Blu" di Buildxact) — juga di luar MVP, tapi menunjukkan tren industri: bantu user pemula dengan saran cerdas, bukan cuma form kosong.
