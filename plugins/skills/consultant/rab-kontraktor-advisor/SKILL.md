---
name: "rab-kontraktor-advisor"
description: "Use when discussing feature, priority, or data-model/UX decisions for the Indonesian small-contractor RAB generator product, or when AHSP/HSPK/SNI vs BOQ/AACE construction-costing standards are relevant."
---

# RAB Generator — Konteks Produk & Panduan Konsultasi

## Peran kamu (Claude)

User adalah solo technical founder yang membangun tool RAB (Rencana Anggaran Biaya) digital untuk kontraktor kecil di Indonesia. Fitur pertama yang dibangun: generator RAB versi MVP, di mana harga satuan material/upah diisi manual oleh kontraktor sendiri per proyek (belum auto-update dari sistem).

Kalau user tanya soal fitur, prioritas, atau keputusan teknis berikutnya untuk produk ini:

- Jawab dengan mempertimbangkan riset & rekomendasi di bawah (standar Indonesia AHSP/HSPK/SNI, standar internasional BOQ/AACE, praktik software modern seperti Buildxact/JobTread).
- Proaktif ingetin kalau ada standar atau praktik yang relevan tapi belum disebut user — itu justru nilai utama skill ini.
- Ingat keputusan MVP yang sudah diambil: harga satuan manual per proyek, belum auto-price. Jangan usulkan fitur yang mengasumsikan integrasi harga otomatis/live pricing kecuali user eksplisit mau bahas fase 2+.
- Beberapa klaim di riset ini masih berstatus "asumsi belum divalidasi ke kontraktor asli" (lihat bagian Asumsi di akhir) — kalau dipakai buat argumen, tandai sebagai asumsi, jangan diperlakukan sebagai fakta pasti sampai user konfirmasi sudah validasi.
- Riset ini dari web search per akhir September 2026 (Permen PUPR No. 8/2023, dst) — kalau user tanya sesuatu yang mungkin sudah berubah (regulasi baru, kompetitor baru), sebaiknya cari lagi, jangan asumsikan riset ini masih 100% akurat selamanya.

---

Riset ini mengonfirmasi bahwa keputusan MVP "harga satuan diisi manual per proyek" sudah sejalan dengan realita: baik regulasi Indonesia maupun praktik riil kontraktor kecil sama-sama memisahkan "kebutuhan teknis pekerjaan" dari "harga pasar lokal" — dua hal yang memang wajar dipisah, bukan disederhanakan.

**Temuan kunci:**

- AHSP ([Permen PUPR No. 8/2023](https://peraturan.bpk.go.id/Details/262345/permen-pupr-no-8-tahun-2023)) mengatur koefisien bahan/upah/alat per satuan pekerjaan — bukan harga rupiahnya.
- HSPK (Perbup/Perwal per daerah, terbit tahunan) yang mengisi harga rupiah, berbeda tiap daerah karena harga material & UMK/UMR lokal berbeda — dan untuk proyek swasta kecil, ini biasanya cuma referensi kasar, bukan acuan wajib.
- Seri SNI "tata cara perhitungan harga satuan pekerjaan" (2835–7395:2008) jadi basis teknis AHSP per kategori (tanah, pondasi, beton, dinding, dst) — tapi tidak ada SNI baku soal cara mengukur volume dari gambar; itu tetap keahlian manual kontraktor.
- Praktik riil: mayoritas kontraktor kecil masih pakai Excel manual (volume × harga satuan, rekap per kategori pakai SUMIFS); sudah ada kompetitor lokal ([RAB Otomatis](https://rabotomatis.com/)) yang embed database AHSP + harga bulanan.
- Internasional (BOQ/RICS NRM) strukturnya nyaris identik (quantity × rate) tapi lebih formal: measurement rules eksplisit, quantity surveyor sebagai profesi, provisional sum untuk item yang belum pasti.
- AACE punya sistem klasifikasi kematangan estimasi (Class 1–5) yang tidak ada padanan eksplisit di Indonesia — layak diadopsi versi sederhana.
- Software modern (Buildxact, JobTread) menunjukkan pola 4-lapis data (cost items → assemblies/cost groups → project templates → schedule) — assembly itu sendiri pada dasarnya "versi internasional dari AHSP".

**Rekomendasi utama** (detail di Bagian 3):

1. Pisahkan "katalog item pekerjaan" (reusable) dari "harga per proyek" (manual) sejak desain skema data awal, supaya siap ditambah auto-price nanti tanpa migrasi besar.
2. UX: tiru pola tabel Excel yang sudah dikenal, auto-kalkulasi live, dan tawarkan simpan item ke katalog pribadi.
3. Validasi ke kontraktor asli sebelum lanjut build — terutama soal overhead/profit riil, device yang dipakai, dan format ekspor (10 poin lengkap di bagian Asumsi).

## Bagian 1: Standar RAB Indonesia

### AHSP (Analisa Harga Satuan Pekerjaan)

AHSP adalah daftar **koefisien** kebutuhan tenaga kerja, bahan, dan alat untuk menghasilkan **1 satuan pekerjaan** (contoh: 1 m² pasangan bata, 1 m³ beton, 10 kg pembesian). AHSP tidak berisi angka rupiah — ia hanya berisi kuantitas kebutuhan per satuan pekerjaan. Harga rupiahnya datang dari sumber terpisah (HSD/HSPK, dibahas di bagian berikut).

**Dasar hukum saat ini**: [Permen PUPR No. 8 Tahun 2023](https://peraturan.bpk.go.id/Details/262345/permen-pupr-no-8-tahun-2023) tentang Pedoman Penyusunan Perkiraan Biaya Pekerjaan Konstruksi Bidang PUPR (ditetapkan 30 Agustus 2023). Peraturan ini mencabut dan menggantikan Permen PUPR No. 1 Tahun 2022, yang sebelumnya menggantikan [Permen PU No. 28 Tahun 2016](https://sibangkoman.pu.go.id/center/pelatihan/uploads/edok/2019/04/cc5d5_Lamp_Permen_PUPR_28-2016_-_AHSP_bidang_Umum-SDA-Cipta_Karya-Bina_Marga_-_Copy.pdf) — jadi ini garis regulasi yang terus diperbarui, bukan aturan statis. Cakupannya: bidang umum, sumber daya air, bina marga, serta cipta karya dan perumahan.

#### Struktur koefisien

Setiap item AHSP punya 3 komponen:

1. **Tenaga kerja (A)** — dalam OH (Orang-Hari): mandor, kepala tukang, tukang, pekerja
2. **Bahan (B)** — dalam satuan material: kg, m³, sak, buah, lembar, dst
3. **Peralatan (C)** — dalam jam/hari pemakaian alat

Formula umum yang dipakai secara konsisten di berbagai referensi bimtek/tutorial:

```latex
D = A + B + C
Harga\ Satuan\ Pekerjaan = D + E
```

di mana E adalah overhead & profit kontraktor. Catatan: beberapa referensi sekunder menyebut E sering diasumsikan sekitar 10%, tapi ini bukan angka yang dikonfirmasi langsung dari teks pasal Permen 8/2023 — perlu dicek ulang, dan di lapangan ini juga sering jadi keputusan kontraktor sendiri (masuk ke daftar asumsi yang perlu divalidasi).

#### Contoh konkret

| Pekerjaan | Koefisien | Sumber |
| --- | --- | --- |
| Pasang 1 m² bata merah | 0,400 OH pekerja + 0,200 OH tukang + 143,81 buah bata + 43,5 kg semen + 0,08 m³ pasir | [kelasteknik.id](https://kelasteknik.id/tips/bank-ahsp-estimasi-biaya) |
| Pembesian 10 kg | Upah Rp 27.460 + Bahan Rp 140.625 + Alat Rp 0 → subtotal Rp 168.085, +10% OH&P → Rp 184.894 (≈Rp 18.489/kg) | [Rumah Material](https://www.rumahmaterial.com/2023/01/analisa-harga-satuan-pembesian-SNI.html) |

Implikasi penting buat produk: AHSP itu **template koefisien yang bisa dipakai ulang lintas proyek dan lintas daerah** (angkanya relatif stabil secara teknis), sedangkan harga satuan dasar (upah per OH, harga bahan per satuan) itu yang berubah-ubah per lokasi dan waktu. Ini alasan kuat untuk memisahkan dua layer data ini di skema database — dibahas lebih lanjut di bagian Rekomendasi Struktur Data.

### HSPK (Harga Satuan Pokok Kegiatan)

HSPK adalah daftar **harga satuan** (dalam Rupiah) untuk bahan bangunan dan upah tenaga kerja yang berlaku di suatu daerah — diterbitkan oleh Dinas PU/Balai Jasa Konstruksi provinsi atau kabupaten/kota, biasanya lewat Peraturan Bupati/Wali Kota/Gubernur atau SK Kepala Dinas, **setahun sekali** (kadang direvisi tengah tahun kalau harga bergerak signifikan).

Contoh nyata: [Balai Jasa Konstruksi Provinsi Jawa Tengah (MASPETRUK)](https://maspetruk.dpubinmarcipka.jatengprov.go.id/harga_satuan/hspk) menerbitkan HSPK untuk 35 kabupaten/kota, edisi terbaru "Edisi I Tahun 2026" — satu edisi per tahun, per daerah berbeda. Contoh regulasi tingkat kabupaten: [Perbup Lima Puluh Kota No. 69 Tahun 2022 tentang HSPK](https://jdih.limapuluhkotakab.go.id/peraturan/detail/db854aa7-084a-4e08-8d63-a48699b8de8f).

#### Struktur & hubungan dengan AHSP

- **HSD (Harga Satuan Dasar)** = harga bahan bangunan hasil survei pasar setempat + upah tenaga kerja berbasis UMK/UMR setempat (dibagi hari kerja)
- **HSPK** = AHSP (koefisien kebutuhan) × HSD lokal, + overhead & profit → hasil akhirnya adalah "harga per satuan pekerjaan" yang siap pakai, spesifik untuk satu daerah

Jadi AHSP itu **koefisien nasional yang relatif stabil**, sementara HSD/HSPK itu **harga lokal yang berubah tiap tahun dan beda tiap daerah** — dua variabel yang harus dipisah di data model produk.

#### Kenapa beda per daerah

- Harga material dipengaruhi jarak dari sumber/pelabuhan dan biaya transport/logistik
- Upah tenaga kerja mengikuti UMK/UMR kabupaten/kota yang berbeda secara legal — bisa selisih signifikan antara kota besar dan daerah terpencil

#### Cara kontraktor kecil biasanya dapat data ini

1. Download PDF/Excel langsung dari situs Dinas PU/Balai Jasa Konstruksi provinsi — tapi tidak semua provinsi/kabupaten punya portal digital yang rapi dan ter-update (Jawa Tengah termasuk yang cukup baik)
2. Survei harga sendiri ke toko material dan tukang setempat — paling umum untuk proyek swasta, karena tidak wajib pakai HSPK resmi
3. Insting/pengalaman dari proyek sebelumnya, disesuaikan dengan kenaikan harga terkini
4. Software RAB lokal berbayar yang sudah embed database harga bulanan (dibahas di bagian Praktik Lapangan)

**Implikasi untuk MVP**: HSPK resmi itu wajib dipakai untuk dasar HPS proyek pemerintah, tapi untuk kontraktor swasta kecil (target user produk ini) ini biasanya cuma jadi *referensi kasar* — harga riil di lapangan, terutama ongkos tukang harian borongan, sering menyimpang dari angka resmi. Ini memperkuat keputusan MVP "harga satuan diisi manual per proyek" — sangat sesuai realita, bukan cuma penyederhanaan teknis.

### SNI untuk Perhitungan Volume Pekerjaan

Perlu diluruskan satu hal dulu: keluarga SNI di bawah ini judulnya "Tata Cara Perhitungan **Harga Satuan** Pekerjaan" — isinya sebetulnya metodologi teknis untuk menyusun koefisien AHSP per kategori pekerjaan (mirip fungsinya dengan AHSP Permen PUPR, dan memang jadi salah satu rujukan teknis di baliknya), bukan aturan "cara mengukur volume dari gambar" (panjang × lebar × tinggi) yang sifatnya matematika teknik umum dan tidak diatur SNI tersendiri di Indonesia — beda dengan pendekatan RICS/NRM internasional yang justru punya *measurement rules* eksplisit (dibahas di bagian BOQ).

#### Seri SNI "Tata Cara Perhitungan Harga Satuan Pekerjaan" (BSN, tahun 2008)

| SNI | Kategori pekerjaan |
| --- | --- |
| [SNI 2835:2008](https://www.slideshare.net/slideshow/sni-28352008tata-cara-perhitungan-harga-satuan-pekerjaan-tanah-untuk-konstruksi-bangunan-gedung-dan-perumahan/69938964) | Pekerjaan tanah |
| [SNI 2836:2008](https://www.slideshare.net/slideshow/sni-28362008tata-cara-perhitungan-harga-satuan-pekerjaan-pondasi-untuk-konstruksi-bangunan-gedung-dan-perumahan/69939015) | Pekerjaan pondasi |
| [SNI 2837:2008](https://www.slideshare.net/slideshow/sni-28372008tata-cara-perhitungan-harga-satuan-pekerjaan-plesteran-untuk-konstruksi-bangunan-gedung-dan-perumamahan/69939038) | Pekerjaan plesteran |
| [SNI 2839:2008](https://www.slideshare.net/slideshow/sni-28392008tata-cara-perhitungan-harga-satuan-pekerjaan-langitlangit-untuk-konstruksi-bangunan-gedung-dan-perumahan/69939057) | Pekerjaan langit-langit |
| [SNI 3434:2008](https://www.slideshare.net/slideshow/sni-34342008tata-cara-perhitungan-harga-satuan-pekerjaan-kayu-untuk-bangunan-gedung-dan-perumahan/69939078) | Pekerjaan kayu |
| [SNI 6897:2008](https://katalog.kemdikbud.go.id/index.php?p=show_detail&id=91585) | Pekerjaan dinding |
| [SNI 7393:2008](https://slideshare.net/EllanSyahnoorizalSir/sni-73932008tata-cara-perhitungan-harga-satuan-pekerjaan-besi-dan-aluminium-untuk-konstruksi-bangunan-gedung-dan-perumahan) | Pekerjaan besi dan aluminium |
| [SNI 7394:2008](https://klinikkonstruksi.jogjaprov.go.id/storage/images/peraturan/SNI%207394-2008%20-%20Tata%20Cara%20Perhit%20Harga%20Sat%20Pek%20Beton%20utk%20konstruksi%20BG%20&%20Rmh.pdf) | Pekerjaan beton |
| [SNI 7395:2008](https://www.slideshare.net/slideshow/sni-73952008tata-cara-perhitungan-harga-satuan-pekerjaan-penutup-lantai-dan-dinding-untuk-konstruksi-bangunan-gedung-dan-perumahan/69938886) | Penutup lantai dan dinding |

Semua terbit tahun 2008 dan judulnya konsisten "...untuk Konstruksi Bangunan Gedung dan Perumahan" — relevan persis untuk skala kontraktor kecil (rumah tinggal, ruko, renovasi), bukan infrastruktur besar.

#### Kategori SNI berbeda: standar desain struktur

[SNI 2847:2019 — Persyaratan Beton Struktural untuk Bangunan Gedung](https://tekonsipil.sv.ugm.ac.id/wp-content/uploads/sites/938/2020/01/SNI-2847-2019-Persyaratan-Beton-Struktural-Untuk-Bangunan-Gedung-1.pdf) itu kategori yang beda lagi — ini standar **desain keamanan struktur** (kekuatan beton, tulangan, dst, mirip fungsinya dengan ACI 318 di AS), dipakai insinyur struktur saat merancang, bukan untuk menghitung RAB. Jangan dicampur dengan SNI 7394:2008 di atas.

**Implikasi untuk MVP**: karena tidak ada SNI baku soal "cara ukur volume dari gambar kerja", volume pekerjaan di produk ini sebaiknya tetap jadi **input manual dari kontraktor** (mereka ukur dari gambar/lapangan sendiri) — produk cukup menyediakan field volume + satuan yang konsisten dengan satuan AHSP/SNI di atas (m², m³, kg, OH, ls), bukan mencoba menghitung otomatis dari gambar (itu scope CAD/BIM take-off, di luar MVP).

### Praktik Riil Kontraktor Kecil di Lapangan

Berdasarkan penelusuran blog/tutorial yang paling banyak beredar untuk audiens Indonesia ([beginisob.com](https://www.beginisob.com/2025/12/cara-membuat-rab-bangunan-di-excel.html), [Asia Arsitek](https://asiaarsitek.com/cara-membuat-rab-rumah-excel/), [Kledo](https://kledo.com/blog/contoh-rab/)), pola yang konsisten muncul:

1. **Excel manual** dengan struktur kolom baku: No, Kategori, Uraian Pekerjaan, Volume, Satuan, Harga Satuan, Subtotal, Catatan. Formula inti: `Subtotal = Volume × Harga Satuan`, direkap per kategori pakai `SUMIFS`.
2. **Template gratis** beredar luas di banyak blog arsitek/konstruksi — volume pencarian dan jumlah situs yang menawarkan "download template RAB Excel gratis" menunjukkan permintaan tinggi, tapi tidak ada satu format yang jadi standar dominan.
3. **Sumber harga satuan campuran**: item "umum" (pasangan bata, plester, dll) sering merujuk AHSP/HSPK pemerintah; item yang sangat lokal/fluktuatif (ongkos tukang harian, harga material saat itu) diisi dari insting/pengalaman kontraktor sendiri.
4. **Sudah ada kompetitor lokal**: [RAB Otomatis](https://rabotomatis.com/) — software desktop Indonesia, model bisnis sekali-bayar (≈Rp140rb, diskon dari Rp240rb), embed database AHSP Cipta Karya resmi (mengacu SE DJBK No. 47/2026) + update harga bahan bulanan. Target eksplisit: "kontraktor kecil-menengah, pemborong, arsitek", dengan klaim "pemula yang tidak hafal rumus" bisa pakai. Ini kompetitor langsung yang sudah menyelesaikan bagian "database AHSP + harga siap pakai" — justru bagian yang di MVP sengaja belum dikerjakan (harga manual per proyek).
5. Ada juga software RAB yang fokus proyek tender pemerintah ([daksasoft](http://www.daksasoft.co.id/konstruksi/) — LPSE, Kurva S, time schedule) — target berbeda dari kontraktor swasta kecil.

**Catatan jujur soal keterbatasan riset ini**: tidak ditemukan thread forum diskusi terbuka (Kaskus, grup Facebook, Reddit) yang spesifik membahas keluhan proses RAB kontraktor kecil — mayoritas hasil pencarian adalah artikel blog SEO dari penyedia jasa arsitek/software, bukan diskusi genuine dari kontraktor sendiri. Insight kualitatif soal *frustrasi nyata* mereka dengan Excel manual (di mana paling sering salah, paling makan waktu) jauh lebih berharga daripada artikel-artikel ini — alasan kuat untuk memprioritaskan wawancara langsung ke kontraktor yang sudah dikenal user (lihat bagian Asumsi untuk Divalidasi).

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
3. **Budget/project templates** — rancangan proyek siap pakai untuk pekerjaan berulang (renovasi dapur, kolam renang, dek) supaya tidak "rebuilding estimates from scratch" tiap proyek baru — padanan digital dari "template RAB Excel" yang sudah dipakai kontraktor Indonesia secara manual (lihat bagian Praktik Lapangan).
4. **Task & schedule templates** — jadwal pra-buat yang ditempel ke proyek — di luar scope RAB murni, lebih ke project management (relevan untuk fase produk selanjutnya, bukan MVP).

#### Pendekatan UX yang bisa diadopsi (bukan fitur mentahnya)

- **Alur kerja tersambung, bukan entry ganda**: "measurements taken from plans automatically flow into material lists and costs" — prinsipnya: begitu volume diisi sekali di satu tempat, semua perhitungan turunan (biaya per item, subtotal kategori, total proyek) ikut update otomatis tanpa user harus input ulang di tempat lain. Ini prinsip UX yang murah diterapkan di MVP tanpa butuh AI/live pricing.
- **Reusable library milik kontraktor sendiri**: cost catalog dan assemblies disimpan per-akun/perusahaan dan dipakai ulang lintas proyek — walau harga di MVP diisi manual per proyek, kontraktor tetap bisa diuntungkan kalau *daftar item pekerjaan* (bukan harganya) bisa disimpan & dipakai ulang, supaya makin lama makin cepat bikin RAB baru.
- **Live pricing integration** (tarik harga real-time dari supplier) dan **automated digital takeoff** (ukur otomatis dari gambar digital) itu fitur canggih yang eksplisit di luar scope MVP (harga manual per proyek) — tapi bagus untuk tahu ini arah lanjutan yang realistis kalau produk berkembang, bukan sesuatu yang harus ditiru sekarang.
- **AI assistant untuk saran material/validasi** (fitur "Blu" di Buildxact) — juga di luar MVP, tapi menunjukkan tren industri: bantu user pemula dengan saran cerdas, bukan cuma form kosong.

## Bagian 3: Sintesis & Rekomendasi

### Perbandingan Indonesia vs Internasional

#### Persamaan

- **Formula inti sama**: kuantitas × harga satuan = biaya item, dijumlah jadi total. AHSP+HSPK setara *unit rate buildup*; BOQ = quantity × rate.
- **Keduanya memisahkan "kebutuhan teknis" dari "harga pasar"** secara konseptual: koefisien AHSP vs harga HSD/HSPK di Indonesia; quantity (disiapkan QS) vs rate (diisi kontraktor saat bidding) di BOQ — tapi di Indonesia pemisahan ini kurang terlihat karena HSPK resmi sudah menggabungkan keduanya jadi satu angka jadi per daerah.
- **Unit pengukuran mirip**: m, m², m³, kg/ton, OH/nr, ls/item.

#### Perbedaan

| Aspek | Indonesia (AHSP/HSPK) | Internasional (BOQ/AACE) |
| --- | --- | --- |
| Sumber otoritas | Top-down pemerintah (Permen PUPR + Perbup/Perwal per daerah, wajib untuk proyek pemerintah) | Standar profesi (RICS), bukan hukum negara, disusun quantity surveyor independen |
| Kematangan estimasi | Tidak ada sistem eksplisit — RAB dianggap "pasti" begitu jadi | AACE punya 5 kelas eksplisit dengan rentang akurasi terikat level definisi desain |
| Item belum pasti | Umumnya tidak ada slot formal — kontraktor kecil sering "all-in"/nebak | Provisional sum & prime cost sum formal untuk item yang belum jelas saat tender |
| Kapan disusun | Sering paralel/sebelum desain final (skala rumah tinggal jarang punya gambar kerja lengkap) | Setelah desain selesai, oleh profesi khusus (QS), sebagai bagian tender |
| Standardisasi format | AHSP terstandardisasi by regulation, tapi RAB Excel kontraktor kecil bebas format, tidak konsisten antar kontraktor | Measurement rules (NRM) eksplisit — "two estimators measuring the same drawings produce bills that compare line by line" |
| Kematangan software pasar | Baru ada software lokal sederhana (mis. RAB Otomatis) dengan database AHSP resmi | Software matang (Buildxact, PlanSwift, JobTread) dengan cost catalog/assembly reusable + live pricing |

**Kesimpulan buat produk**: tidak perlu meniru mentah BOQ/AACE (itu didesain untuk proyek besar dengan QS profesional) — tapi tiga konsepnya layak diadopsi versi sederhana: (1) pisahkan quantity dari rate di level data, (2) sediakan slot untuk item "belum pasti", (3) tandai kematangan estimasi.

### Rekomendasi Struktur Data

Prinsip utama: **pisahkan "katalog item pekerjaan" (reusable) dari "harga per proyek" (manual, sesuai keputusan MVP)** sejak desain skema awal — supaya kalau nanti mau tambah auto-update harga (fase 2+, pakai data AHSP/HSPK resmi atau live pricing), tidak perlu migrasi besar.

#### Entitas inti

| Entitas | Fungsi | Field kunci |
| --- | --- | --- |
| `work_item` (katalog pekerjaan) | Master data milik akun kontraktor, dipakai ulang lintas proyek — analog *assembly*/AHSP | nama pekerjaan, kategori, satuan default, catatan |
| `project` (proyek) | Satu RAB per proyek/klien | nama proyek, klien, tanggal, status ("Estimasi Awal" / "RAB Final") |
| `rab_item` (baris RAB) | Satu baris dalam RAB, milik satu proyek | proyek_id, work_item_id (opsional, nullable untuk item custom sekali pakai), uraian, kategori, volume, satuan, harga_satuan, subtotal (computed), catatan/asumsi, flag "belum pasti" (opsional, terinspirasi provisional sum) |
| `project_overhead` | Overhead & profit per proyek | persentase atau nominal — field terpisah, bukan di-hardcode ke tiap item, karena persentase (sering diasumsikan ~10% di berbagai referensi) sebenarnya keputusan tiap kontraktor, bukan angka wajib |

#### Kenapa `work_item` dipisah dari `rab_item`

Di MVP, harga tetap manual per proyek (`rab_item.harga_satuan` diisi tangan) — tapi *nama & satuan pekerjaan* ("Pasang 1 m² dinding bata merah", satuan m²) hampir selalu sama antar proyek. Kalau `work_item` sudah jadi entitas sendiri sejak awal, kontraktor bisa simpan & pakai ulang daftar pekerjaan mereka (insight dari cost catalog Buildxact/JobTread) tanpa harus ketik ulang tiap proyek baru — dan strukturnya sudah siap menampung koefisien/harga resmi nanti tanpa redesain skema.

#### Formula RAB

```latex
Subtotal_{item} = Volume \times HargaSatuan
Total_{kategori} = \sum Subtotal_{item \in kategori}
Total_{proyek} = \sum Total_{kategori} \times (1 + Overhead\%)
```

#### Kategori pekerjaan

Sediakan starter list kategori umum yang mengikuti pengelompokan SNI/AHSP (persiapan, tanah, pondasi, struktur beton, dinding, plesteran, atap, lantai, finishing, mekanikal-elektrikal) sebagai default yang bisa diedit — supaya kontraktor tidak mulai dari kosong, tapi tetap bebas menyesuaikan ke kebiasaan mereka sendiri.

#### Struktur koefisien (fase 2+, tidak untuk MVP)

Kalau nanti mau tambah auto-price dari AHSP/HSPK resmi, siapkan tabel terpisah `work_item_component` (work_item_id, jenis: bahan/upah/alat, nama komponen, satuan komponen, koefisien) yang MVP-nya dibiarkan kosong — skema DB sudah siap tanpa perlu dipakai dulu.

### Rekomendasi UX Minim-Friksi

1. **Tiru pola Excel yang sudah mereka kenal** — tabel: No, Uraian, Kategori, Volume, Satuan, Harga Satuan, Subtotal. Jangan reinvent UI; kontraktor kecil sudah terbiasa dengan format ini dari template Excel yang beredar luas — UI yang mirip = friksi belajar mendekati nol.
2. **Auto-kalkulasi live**: begitu volume/harga diinput, subtotal per item, rekap per kategori, dan total proyek langsung update otomatis. Hilangkan kebutuhan mereka menulis/mengingat rumus sendiri.
3. **Katalog item pekerjaan pribadi**: begitu kontraktor input satu jenis pekerjaan, tawarkan simpan ke "daftar pekerjaan saya" — proyek berikutnya tinggal cari/pilih, bukan ketik ulang dari nol.
4. **Kategori starter bawaan, tapi bisa diedit**: sediakan daftar kategori umum ala SNI/AHSP sebagai default, bukan wajib.
5. **Desain ramah HP**: banyak kontraktor kerja di lapangan, bukan di depan laptop. Form input sebaiknya nyaman diisi dari HP.
6. **Ekspor ke format yang sudah biasa dipakai**: PDF rapi (dan idealnya Excel) untuk diberikan ke klien.
7. **Sembunyikan istilah teknis, bukan konsepnya**: label di UI pakai bahasa yang sudah dikenal kontraktor dari RAB manual — jangan paksa user belajar istilah baru seperti "assembly" atau "provisional sum".
8. **Status kematangan RAB yang disederhanakan**: dua status saja — "Estimasi Awal" vs "RAB Final".
9. **Progressive disclosure untuk fase depan**: susun UI supaya nanti kalau fase 2 menambah auto-price, tinggal "nempel" tanpa redesain total.

### Asumsi yang Perlu Divalidasi ke Kontraktor

Riset ini menjelaskan standar & praktik umum, tapi bukan pengganti wawancara langsung. Klaim/asumsi berikut sebaiknya dicek ke kontraktor kecil asli sebelum jadi keputusan desain final:

1. **Tool yang dipakai sekarang** — apakah benar masih Excel manual, atau sebagian sudah pakai software serupa (RAB Otomatis atau lainnya).
2. **Angka overhead & profit riil** — asumsi ~10% dari referensi sekunder belum dikonfirmasi dari teks resmi Permen 8/2023, kemungkinan besar bervariasi per kontraktor/jenis proyek/daerah.
3. **Relevansi kategori standar SNI/AHSP** — apakah kontraktor benar butuh pengelompokan formal ini.
4. **Seberapa sering HSPK/AHSP resmi benar-benar dipakai** untuk proyek swasta kecil.
5. **Device yang dipakai bikin RAB** — HP, laptop, atau keduanya.
6. **Format yang diberikan ke klien saat ini** — PDF, print, Excel, atau foto/WhatsApp.
7. **Kebutuhan detail uraian per item** — nama singkat vs deskripsi/spek material detail.
8. **Nilai fitur katalog item reusable** — apakah benar dirasa berguna, atau tiap proyek dianggap unik.
9. **Skala tipikal satu RAB** — rata-rata berapa baris/item per proyek.
10. **Familiaritas dengan konsep volume & satuan** — apakah m²/m³/OH/ls sudah dipahami natural.

Wawancara singkat (15-20 menit) yang fokus ke poin #1, #2, #5, #6, dan #8 paling langsung memengaruhi keputusan desain MVP berikutnya.