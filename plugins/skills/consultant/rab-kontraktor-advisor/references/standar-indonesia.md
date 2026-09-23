# RAB Generator — Riset Standar RAB Indonesia

Referensi skill `rab-kontraktor-advisor`. Konteks produk dan aturan pakainya ada di `SKILL.md`.

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

Implikasi penting buat produk: AHSP itu **template koefisien yang bisa dipakai ulang lintas proyek dan lintas daerah** (angkanya relatif stabil secara teknis), sedangkan harga satuan dasar (upah per OH, harga bahan per satuan) itu yang berubah-ubah per lokasi dan waktu. Ini alasan kuat untuk memisahkan dua layer data ini di skema database — dibahas lebih lanjut di bagian Rekomendasi Struktur Data ([rekomendasi.md](rekomendasi.md)).

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

Perlu diluruskan satu hal dulu: keluarga SNI di bawah ini judulnya "Tata Cara Perhitungan **Harga Satuan** Pekerjaan" — isinya sebetulnya metodologi teknis untuk menyusun koefisien AHSP per kategori pekerjaan (mirip fungsinya dengan AHSP Permen PUPR, dan memang jadi salah satu rujukan teknis di baliknya), bukan aturan "cara mengukur volume dari gambar" (panjang × lebar × tinggi) yang sifatnya matematika teknik umum dan tidak diatur SNI tersendiri di Indonesia — beda dengan pendekatan RICS/NRM internasional yang justru punya *measurement rules* eksplisit (dibahas di bagian BOQ, [standar-internasional.md](standar-internasional.md)).

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

**Catatan jujur soal keterbatasan riset ini**: tidak ditemukan thread forum diskusi terbuka (Kaskus, grup Facebook, Reddit) yang spesifik membahas keluhan proses RAB kontraktor kecil — mayoritas hasil pencarian adalah artikel blog SEO dari penyedia jasa arsitek/software, bukan diskusi genuine dari kontraktor sendiri. Insight kualitatif soal *frustrasi nyata* mereka dengan Excel manual (di mana paling sering salah, paling makan waktu) jauh lebih berharga daripada artikel-artikel ini — alasan kuat untuk memprioritaskan wawancara langsung ke kontraktor yang sudah dikenal user (lihat bagian Asumsi di [rekomendasi.md](rekomendasi.md)).
