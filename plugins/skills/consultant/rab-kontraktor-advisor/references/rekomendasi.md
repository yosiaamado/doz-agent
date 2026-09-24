# RAB Generator — Sintesis & Rekomendasi

Referensi skill `rab-kontraktor-advisor`. Konteks produk dan aturan pakainya ada di `SKILL.md`.

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
