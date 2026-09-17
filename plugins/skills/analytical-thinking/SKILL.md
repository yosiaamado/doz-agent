---
name: analytical-thinking
description: Kerangka berpikir analitis untuk memecah masalah kompleks, debugging sistematis, root cause analysis, membandingkan opsi/trade-off, dan mengambil keputusan berbasis data. Pakai saat user minta "analisis", "kenapa ini terjadi", "bandingkan opsi", "mana yang lebih baik", saat bug sulit dilacak, atau saat keputusan teknis punya banyak faktor.
---

# Analytical Thinking

Tujuannya: jawaban yang **benar dan bisa dipertanggungjawabkan**, bukan tebakan yang terdengar meyakinkan.

## 1. Definisikan masalahnya

- Tulis ulang masalah dalam satu kalimat. Apa gejalanya, di mana, sejak kapan, dan siapa yang terdampak?
- Pisahkan **fakta** (terlihat di log, data, atau kode) dari **asumsi**.
- Tentukan kriteria "selesai": seperti apa kondisi yang benar?

## 2. Pecah masalahnya (MECE)

- Uraikan jadi bagian yang tidak tumpang tindih dan mencakup semua kemungkinan.
- Contoh untuk "API lambat": client → network → load balancer → app → DB → layanan eksternal.
- Pakai issue tree: masalah → sub-masalah → pertanyaan yang bisa diuji.

## 3. Hipotesis & verifikasi

- Susun beberapa hipotesis, urutkan berdasarkan **kemungkinan × biaya untuk mengecek** (yang murah dan mungkin dicek duluan).
- Untuk setiap hipotesis, tentukan bukti apa yang akan membenarkan atau membantahnya, lalu cari bukti itu (baca kode, log, metric, reproduksi).
- Ubah satu variabel dalam satu waktu. Jangan menyimpulkan tanpa bukti.

## 4. Root cause

- Pakai **5 Whys**: terus tanya "kenapa" sampai ketemu penyebab yang kalau diperbaiki, masalahnya tidak muncul lagi.
- Bedakan pemicu (trigger), penyebab (root cause), dan faktor yang memperparah.
- Tanyakan juga: kenapa masalah ini tidak terdeteksi lebih awal (test, monitoring)?

## 5. Membandingkan opsi

Buat matriks keputusan:

| Kriteria (bobot) | Opsi A | Opsi B | Opsi C |
|---|---|---|---|
| Dampak ke user (30%) | | | |
| Effort / waktu (25%) | | | |
| Risiko (20%) | | | |
| Maintainability (15%) | | | |
| Biaya (10%) | | | |

- Sebutkan trade-off secara eksplisit: apa yang dikorbankan di setiap opsi.
- Pertimbangkan reversibilitas: keputusan yang mudah dibatalkan boleh diambil cepat, sedangkan yang sulit dibatalkan perlu analisis lebih dalam.
- Pertimbangkan second-order effect: apa dampak lanjutannya 3–6 bulan ke depan?

## 6. Hindari bias

- **Confirmation bias:** cari juga bukti yang membantah.
- **Anchoring:** jangan terpaku pada penjelasan pertama.
- **Korelasi ≠ kausalitas.**
- **Survivorship bias:** perhatikan data yang tidak kelihatan.
- Kalau datanya kurang, katakan begitu dan sebutkan data apa yang dibutuhkan.

## 7. Format jawaban

```
**Kesimpulan:** <1-2 kalimat, jawaban langsung>
**Bukti:** <fakta pendukung, dengan sumber: file:line / log / angka>
**Alasan:** <rantai logika singkat>
**Rekomendasi:** <tindakan konkret, urut prioritas>
**Ketidakpastian:** <apa yang belum pasti + cara memastikannya>
```

Mulai dengan kesimpulan (bottom line up front). Tingkat keyakinan harus sepadan dengan buktinya.
