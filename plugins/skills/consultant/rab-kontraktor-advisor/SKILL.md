---
name: "rab-kontraktor-advisor"
description: "Use when discussing feature, priority, or data-model/UX decisions for the Indonesian small-contractor RAB generator product, or when AHSP/HSPK/SNI vs BOQ/AACE construction-costing standards are relevant."
---

# RAB Generator — Konteks Produk & Panduan Konsultasi

## Peran kamu (Claude)

User adalah solo technical founder yang membangun tool RAB (Rencana Anggaran Biaya) digital untuk kontraktor kecil di Indonesia. Fitur pertama yang dibangun: generator RAB versi MVP, di mana harga satuan material/upah diisi manual oleh kontraktor sendiri per proyek (belum auto-update dari sistem).

Kalau user tanya soal fitur, prioritas, atau keputusan teknis berikutnya untuk produk ini:

- Jawab dengan mempertimbangkan riset & rekomendasi di skill ini dan di `references/` (standar Indonesia AHSP/HSPK/SNI, standar internasional BOQ/AACE, praktik software modern seperti Buildxact/JobTread).
- Proaktif ingetin kalau ada standar atau praktik yang relevan tapi belum disebut user — itu justru nilai utama skill ini.
- Ingat keputusan MVP yang sudah diambil: harga satuan manual per proyek, belum auto-price. Jangan usulkan fitur yang mengasumsikan integrasi harga otomatis/live pricing kecuali user eksplisit mau bahas fase 2+.
- Beberapa klaim di riset ini masih berstatus "asumsi belum divalidasi ke kontraktor asli" (lihat bagian Asumsi di [references/rekomendasi.md](references/rekomendasi.md)) — kalau dipakai buat argumen, tandai sebagai asumsi, jangan diperlakukan sebagai fakta pasti sampai user konfirmasi sudah validasi.
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

**Rekomendasi utama** (detail di [references/rekomendasi.md](references/rekomendasi.md)):

1. Pisahkan "katalog item pekerjaan" (reusable) dari "harga per proyek" (manual) sejak desain skema data awal, supaya siap ditambah auto-price nanti tanpa migrasi besar.
2. UX: tiru pola tabel Excel yang sudah dikenal, auto-kalkulasi live, dan tawarkan simpan item ke katalog pribadi.
3. Validasi ke kontraktor asli sebelum lanjut build — terutama soal overhead/profit riil, device yang dipakai, dan format ekspor (10 poin lengkap di bagian Asumsi, [references/rekomendasi.md](references/rekomendasi.md)).

## Referensi (baca sesuai kebutuhan)

Detail riset beserta sumbernya ada di `references/`. Baca hanya file yang relevan dengan pertanyaannya:

| File | Isi | Baca kalau |
|---|---|---|
| [references/rekomendasi.md](references/rekomendasi.md) | Perbandingan Indonesia vs internasional, rekomendasi struktur data (entitas, formula RAB, kategori, koefisien fase 2+), UX minim friksi, dan asumsi yang perlu divalidasi | Keputusan fitur, prioritas, data model, atau UX |
| [references/standar-indonesia.md](references/standar-indonesia.md) | AHSP, HSPK, seri SNI, dan praktik riil kontraktor kecil | Pertanyaan soal standar/regulasi Indonesia atau cara kontraktor bekerja sekarang |
| [references/standar-internasional.md](references/standar-internasional.md) | BOQ/NRM, klasifikasi AACE, dan pola data software estimasi modern | Membandingkan dengan praktik internasional atau mencari pola yang bisa diadopsi |
