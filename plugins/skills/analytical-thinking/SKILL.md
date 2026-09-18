---
name: analytical-thinking
description: Kerangka berpikir analitis untuk memecah masalah kompleks, debugging sistematis, root cause analysis, estimasi, membandingkan opsi/trade-off, dan mengambil keputusan berbasis bukti (termasuk pre-mortem dan ADR). Pakai saat user minta "analisis", "kenapa ini terjadi", "bandingkan opsi", "mana yang lebih baik", "estimasi", saat bug sulit dilacak, atau saat keputusan teknis punya banyak faktor.
model: opus
---

# Analytical Thinking

Tujuannya: jawaban yang **benar dan bisa dipertanggungjawabkan**, bukan tebakan yang terdengar meyakinkan.

## 1. Definisikan masalahnya

- Tulis ulang masalah dalam satu kalimat: apa gejalanya, di mana, sejak kapan, seberapa sering, dan siapa yang terdampak?
- Pisahkan **fakta** (terlihat di log, data, atau kode) dari **asumsi** dan **opini**.
- Tentukan kriteria "selesai": seperti apa kondisi yang benar, dan bagaimana mengukurnya?
- Pastikan masalah yang dipecahkan adalah masalah yang tepat. Tanyakan: kenapa ini penting?

## 2. Pecah masalahnya (MECE)

- Uraikan jadi bagian yang **tidak tumpang tindih dan mencakup semua kemungkinan** (Mutually Exclusive, Collectively Exhaustive).
- Contoh untuk "API lambat": client → network/DNS → load balancer → app (CPU, memori, GC, lock) → DB (query, lock, koneksi) → layanan eksternal.
- Pakai **issue tree:** masalah → sub-masalah → pertanyaan yang bisa diuji.
- **First principles:** kalau terjebak, kembali ke fakta dasar (apa yang pasti benar?) lalu bangun ulang penalarannya dari sana.

## 3. Hipotesis & verifikasi

- Susun beberapa hipotesis, lalu urutkan berdasarkan **kemungkinan × murahnya untuk dicek**.
- Untuk setiap hipotesis, tentukan dulu bukti apa yang akan **membenarkan** atau **membantahnya**, baru cari buktinya.
- **Ubah satu variabel dalam satu waktu.** Catat setiap percobaan beserta hasilnya.
- **Debugging sistematis:**
  1. Reproduksi masalahnya secara konsisten.
  2. Persempit area dengan bisection (`git bisect`, matikan komponen satu per satu, atau binary search di data).
  3. Bandingkan kondisi yang jalan dengan yang tidak: apa bedanya?
  4. Cek hal yang baru berubah: deploy, config, dependency, dan data.
- Jangan menyimpulkan tanpa bukti. "Mungkin karena X" belum sama dengan "karena X".

## 4. Root cause

- **5 Whys:** terus tanya "kenapa" sampai ketemu penyebab yang kalau diperbaiki, masalahnya tidak muncul lagi.
- Bedakan:
  - **Pemicu (trigger):** peristiwa yang memulai masalah.
  - **Root cause:** kelemahan mendasar yang membuat masalah bisa terjadi.
  - **Faktor pemberat:** hal yang memperparah dampaknya.
- Untuk masalah yang penyebabnya banyak, pakai **diagram fishbone** dengan kategori: orang, proses, teknologi, data, lingkungan.
- Tanyakan juga: **kenapa masalah ini tidak terdeteksi lebih awal** (test, monitoring, review)? Itu biasanya perbaikan yang paling berharga.
- Fokus ke sistem dan proses, bukan menyalahkan orang (blameless).

## 5. Estimasi

- **Estimasi Fermi:** pecah angka besar jadi faktor-faktor yang bisa ditebak dengan wajar, lalu kalikan. Tuliskan setiap asumsinya.
  - Contoh: request/hari = user aktif × sesi per user × request per sesi.
- Beri **rentang, bukan angka tunggal**: optimis / realistis / pesimis.
- Untuk estimasi effort, pecah pekerjaan sampai unit terkecil. Tambahkan buffer untuk hal yang belum diketahui (integrasi, testing, review, deploy).
- Bandingkan dengan data historis kalau ada. Manusia cenderung terlalu optimis.

## 6. Membandingkan opsi

**Klasifikasi keputusan dulu:**
- **Two-way door** (mudah dibatalkan): putuskan cepat, cukup dengan informasi ±70%.
- **One-way door** (sulit atau mahal dibatalkan, misalnya skema data, bahasa/framework, vendor lock-in, kontrak API publik): analisis lebih dalam dan tulis sebagai ADR.

**Matriks keputusan berbobot:**

| Kriteria (bobot) | Opsi A | Opsi B | Opsi C |
|---|---|---|---|
| Dampak ke user/bisnis (30%) | | | |
| Effort / waktu (20%) | | | |
| Risiko (20%) | | | |
| Maintainability / kompleksitas (15%) | | | |
| Biaya total (TCO) (15%) | | | |

Beri skor 1–5, kalikan dengan bobot, lalu jumlahkan. Bobotnya disesuaikan dengan konteks.

- **Selalu sertakan opsi "tidak melakukan apa-apa"** sebagai pembanding.
- Sebutkan **trade-off** secara eksplisit: apa yang dikorbankan di setiap opsi.
- **Second-order effect:** apa dampak lanjutannya dalam 3–12 bulan? Siapa lagi yang terdampak?
- **Pre-mortem:** bayangkan 6 bulan lagi keputusan ini gagal total. Apa penyebab yang paling mungkin? Mitigasi penyebab itu sekarang.
- **Uji sensitivitas:** apakah keputusannya berubah kalau salah satu asumsi utama meleset 2×?

## 7. Kualitas data & bukti

- Cek sumber dan kualitas datanya: sampel cukup? periode representatif? ada data yang hilang atau outlier?
- Pakai **persentil (p50/p95/p99)**, bukan hanya rata-rata, untuk latency dan distribusi yang miring.
- Bandingkan dengan **baseline** (sebelum vs sesudah, kelompok kontrol).
- Bedakan tingkat bukti:
  - Diukur langsung > dari log/metric > dari kode > dari dokumentasi > dari ingatan/asumsi.

## 8. Hindari bias

| Bias | Penangkal |
|---|---|
| Confirmation bias | Cari bukti yang **membantah** hipotesis sendiri |
| Anchoring | Jangan terpaku pada penjelasan atau angka pertama |
| Korelasi ≠ kausalitas | Cari mekanisme penyebabnya dan uji dengan eksperimen |
| Survivorship bias | Perhatikan data yang tidak terlihat (user yang sudah churn, request yang timeout) |
| Sunk cost | Nilai opsi berdasarkan masa depan, bukan apa yang sudah dikeluarkan |
| Recency / availability | Cek data historis, bukan hanya kejadian terakhir yang paling diingat |

Kalau datanya kurang, **katakan begitu** dan sebutkan data apa yang dibutuhkan beserta cara mendapatkannya.

## 9. Format jawaban

```
**Kesimpulan:** <1-2 kalimat, jawaban langsung>
**Keyakinan:** <tinggi/sedang/rendah> — <kenapa>
**Bukti:** <fakta pendukung dengan sumber: file:line / log / angka>
**Alasan:** <rantai logika singkat>
**Opsi & trade-off:** <kalau ada pilihan>
**Rekomendasi:** <tindakan konkret, urut prioritas>
**Ketidakpastian:** <apa yang belum pasti + cara memastikannya>
```

Mulai dengan kesimpulan (bottom line up front). Tingkat keyakinan harus sepadan dengan buktinya. Untuk keputusan one-way door, tawarkan untuk menuliskannya sebagai ADR.
