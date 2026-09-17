---
name: business-thinking
description: Kerangka berpikir bisnis dan produk untuk menilai fitur, prioritas, model bisnis, pricing, unit economics, metrik (KPI), validasi ide, dan menerjemahkan kebutuhan bisnis ke keputusan teknis. Pakai saat user membahas ide bisnis/startup, fitur mana yang dibangun duluan, MVP, monetisasi, target pasar, go-to-market, atau "apakah ini worth it".
---

# Business Thinking

Setiap keputusan produk dan teknis harus bisa menjawab: **siapa yang diuntungkan, seberapa besar, dan berapa biayanya?**

## 1. Mulai dari masalah, bukan solusi

- **Siapa** user atau pelanggannya (segmen spesifik, bukan "semua orang")?
- **Masalah apa** yang mereka alami, seberapa sering, dan seberapa sakit?
- **Bagaimana mereka mengatasinya sekarang** (kompetitor atau cara manual)? Kenapa itu belum cukup?
- Kerangka Jobs To Be Done: "Saat [situasi], saya ingin [motivasi], supaya [hasil]."

## 2. Validasi sebelum membangun

- Tulis asumsi paling berisiko (desirability, viability, feasibility), lalu uji yang paling berisiko duluan.
- Cara validasi murah: wawancara user, landing page + waitlist, pre-order, concierge/manual MVP, prototipe.
- MVP adalah versi **terkecil** yang bisa membuktikan atau membantah asumsi utama, bukan versi murahan dari produk lengkap.

## 3. Prioritas fitur

- **RICE** = (Reach × Impact × Confidence) / Effort
- **MoSCoW:** Must / Should / Could / Won't
- **Impact vs Effort:** kerjakan quick win duluan, hindari yang effort-nya tinggi tapi dampaknya rendah.
- Selalu tanya: kalau fitur ini **tidak** dibangun, apa yang terjadi?

## 4. Model bisnis & unit economics

- Sumber pendapatan: subscription, transaksi/komisi, usage-based, one-time, iklan, freemium.
- Metrik inti:
  - **CAC** (biaya akuisisi per pelanggan)
  - **LTV** = ARPU × gross margin × umur rata-rata pelanggan. Targetkan **LTV : CAC ≥ 3 : 1**
  - **Payback period** CAC idealnya < 12 bulan
  - **Gross margin** (hitung juga biaya server, API/AI, payment fee, support)
  - **Burn rate & runway**
- Hitung break-even: berapa pelanggan atau transaksi yang dibutuhkan untuk menutup biaya tetap?

## 5. Pricing

- Tentukan harga berdasarkan **nilai** yang dirasakan user, bukan cuma biaya + margin.
- Buat tier yang jelas (misalnya Free / Pro / Business) dengan pembeda yang bermakna.
- Pertimbangkan daya beli pasar lokal dan metode pembayaran yang umum dipakai (misalnya QRIS, e-wallet, VA).
- Uji harga, jangan menebak.

## 6. Metrik & KPI

- Tetapkan satu **North Star Metric** yang mencerminkan nilai untuk user.
- Funnel **AARRR:** Acquisition → Activation → Retention → Referral → Revenue.
- Retention adalah bukti product-market fit. Lihat kurva cohort: apakah melandai, bukan turun terus ke nol?
- Hindari vanity metric (total download, pageview) tanpa konteks.
- Setiap fitur baru punya metrik keberhasilan yang ditentukan **sebelum** dibangun.

## 7. Pasar & kompetisi

- Ukuran pasar: TAM → SAM → SOM (hitung bottom-up: jumlah calon pelanggan × harga).
- Posisi: kenapa pelanggan memilih kita? (harga, kecepatan, niche, pengalaman, distribusi)
- Moat: network effect, data, switching cost, brand, atau biaya yang lebih rendah.

## 8. Menerjemahkan ke keputusan teknis

- Pilih solusi yang paling sederhana yang cukup untuk tahap bisnis saat ini. Jangan over-engineer sebelum ada traction.
- Pakai layanan jadi (auth, payment, email) untuk hal yang bukan inti bisnis.
- Pasang analytics dan event tracking sejak awal supaya keputusan berbasis data.
- Tech debt boleh diambil secara sadar, asal dicatat.

## 9. Format jawaban

```
**Rekomendasi:** <keputusan + 1 kalimat alasan>
**Asumsi kunci:** <yang harus benar supaya ini berhasil>
**Angka:** <estimasi kasar: biaya, potensi pendapatan, metrik>
**Risiko:** <apa yang bisa gagal + mitigasinya>
**Langkah berikutnya:** <eksperimen/aksi konkret, termurah dulu>
```

Terus terang kalau sebuah ide lemah. Sebutkan alasannya dan alternatifnya.
