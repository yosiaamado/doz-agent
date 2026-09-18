---
name: business-thinking
description: Kerangka berpikir bisnis dan produk profesional. Mencakup discovery & validasi ide, PRD/one-pager, prioritas fitur (RICE, WSJF), model bisnis & unit economics, pricing, metrik (North Star, OKR, AARRR), eksperimen/A-B test, build vs buy, pasar & kompetisi, dan kepatuhan (UU PDP). Pakai saat user membahas ide bisnis/startup, fitur mana yang dibangun duluan, MVP, monetisasi, target pasar, go-to-market, roadmap, atau "apakah ini worth it".
model: opus
---

# Business Thinking

Setiap keputusan produk dan teknis harus bisa menjawab: **siapa yang diuntungkan, seberapa besar, berapa biayanya, dan bagaimana kita tahu kalau berhasil?**

## 1. Mulai dari masalah, bukan solusi

- **Siapa** user atau pelanggannya? Pakai segmen spesifik, bukan "semua orang". Bedakan **user** (yang memakai) dan **buyer** (yang membayar).
- **Masalah apa** yang mereka alami, seberapa sering, dan seberapa sakit? Apakah mereka sudah mengeluarkan uang atau waktu untuk mengatasinya?
- **Bagaimana mereka mengatasinya sekarang** (kompetitor, spreadsheet, cara manual)? Kenapa itu belum cukup?
- **Jobs To Be Done:** "Saat [situasi], saya ingin [motivasi], supaya [hasil]."
- **Lean Canvas** untuk ide baru: problem, customer segment, unique value proposition, solution, channel, revenue, cost, key metric, dan unfair advantage.

## 2. Discovery & validasi sebelum membangun

- Tulis asumsi-asumsi yang ada, lalu kelompokkan jadi tiga:
  - **Desirability:** apakah mereka mau?
  - **Viability:** apakah menguntungkan?
  - **Feasibility:** apakah bisa dibangun?
- Uji asumsi yang **paling berisiko dan paling tidak pasti** duluan.
- **Cara validasi murah**, diurutkan dari yang termurah:
  1. Wawancara user. Tanyakan perilaku masa lalu, bukan pendapat tentang masa depan (The Mom Test).
  2. Landing page + waitlist.
  3. Fake door test.
  4. Pre-order atau LOI.
  5. Concierge/manual MVP (layani secara manual dulu).
  6. Prototipe yang bisa diklik.
- **Tentukan kriteria sukses sebelum eksperimen dimulai.** Contoh: "≥ 10% pengunjung mendaftar waitlist dalam 2 minggu".
- **MVP** adalah versi **terkecil** yang bisa membuktikan atau membantah asumsi utama, bukan versi murahan dari produk lengkap.

## 3. PRD / one-pager (sebelum fitur dibangun)

```markdown
# <Nama fitur>
## Masalah
<siapa, masalah apa, bukti (data/kutipan user)>
## Tujuan & metrik sukses
<metrik utama + target + guardrail metric yang tidak boleh turun>
## Non-goal
<apa yang sengaja TIDAK dikerjakan>
## Solusi (ringkas)
<alur utama, user story + acceptance criteria>
## Risiko & asumsi
## Rencana rilis
<bertahap? feature flag? eksperimen?>
```

## 4. Prioritas

- **RICE** = (Reach × Impact × Confidence) / Effort. Cocok untuk membandingkan banyak ide fitur.
- **WSJF / Cost of Delay:** (nilai bisnis + urgensi waktu + pengurangan risiko) / ukuran pekerjaan. Cocok kalau ada tenggat atau risiko.
- **MoSCoW** (Must / Should / Could / Won't) untuk memotong scope sebuah rilis.
- **Kano:** bedakan fitur dasar (wajib ada), fitur performa (makin banyak makin baik), dan fitur penyenang.
- Selalu tanyakan: **kalau fitur ini TIDAK dibangun, apa yang terjadi?** Dan apa yang dikorbankan kalau kita mengerjakannya (opportunity cost)?

## 5. Model bisnis & unit economics

- **Sumber pendapatan:** subscription, transaksi/komisi (take rate), usage-based, one-time/lisensi, iklan, atau freemium.
- **Metrik inti:**
  - **CAC:** total biaya akuisisi ÷ pelanggan baru.
  - **LTV:** ARPU × gross margin × umur rata-rata pelanggan (≈ 1 / churn bulanan). Targetkan **LTV : CAC ≥ 3 : 1**.
  - **Payback CAC** idealnya < 12 bulan (lebih pendek untuk UKM/konsumen).
  - **Gross margin:** hitung **semua** biaya variabel, termasuk server, API/AI per request, payment fee, support, dan refund.
  - **Churn & NRR** (Net Revenue Retention). NRR > 100% berarti pelanggan lama tumbuh sendiri.
  - **Burn rate & runway:** kas ÷ burn bulanan.
- **Break-even:** biaya tetap ÷ margin kontribusi per unit = jumlah pelanggan/transaksi yang dibutuhkan.
- Buat model di spreadsheet dengan skenario **pesimis / realistis / optimis**, dan tulis setiap asumsinya secara eksplisit.

## 6. Pricing

- Tentukan harga berdasarkan **nilai** yang dirasakan user (penghematan waktu atau uang, tambahan pendapatan), bukan hanya biaya + margin.
- **Value metric:** harga naik mengikuti nilai yang didapat (per user, per transaksi, per volume).
- Buat tier yang jelas (misalnya Free / Pro / Business) dengan pembeda yang bermakna. Tier tengah biasanya jadi pilihan utama.
- Sesuaikan dengan pasar lokal: daya beli, dan metode pembayaran yang umum (QRIS, e-wallet, virtual account, paylater).
- **Uji harga, jangan menebak.** Pakai wawancara willingness-to-pay (Van Westendorp), A/B test di landing page, atau coba ke pelanggan baru dulu.

## 7. Metrik & tujuan

- **North Star Metric:** satu metrik yang mencerminkan nilai yang diterima user dan berkorelasi dengan pendapatan. Contoh: "jumlah transaksi sukses per minggu", bukan "jumlah download".
- **Funnel AARRR:** Acquisition → Activation → Retention → Referral → Revenue. Perbaiki tahap yang paling bocor duluan.
- **Retention** adalah bukti product-market fit. Lihat **kurva cohort**: yang sehat akan melandai, bukan terus turun ke nol.
- **OKR:**
  - Objective kualitatif yang menginspirasi, dengan 2–4 Key Result yang terukur.
  - Key Result berupa outcome (hasil), bukan output (fitur yang dikirim).
- Hindari vanity metric (total download, pageview, jumlah registrasi) tanpa konteks aktivasi dan retensi.
- Setiap fitur punya **metrik sukses dan guardrail metric** yang ditentukan **sebelum** dibangun.

## 8. Eksperimen & A/B test

- **Hipotesis:** "Kalau kita [ubah X], maka [metrik Y] naik [Z%], karena [alasan]."
- Tentukan dulu metrik utama, guardrail, ukuran sampel minimum (pakai kalkulator sample size), dan durasi (minimal 1–2 siklus mingguan).
- **Jangan menghentikan test lebih awal** begitu terlihat "menang" (peeking). Hasilnya jadi bias.
- Kalau trafik kecil, lebih baik melakukan perubahan besar atau riset kualitatif daripada A/B test untuk perubahan kecil.

## 9. Build vs buy

- **Beli atau pakai layanan jadi** untuk hal yang bukan inti pembeda bisnis: auth, payment, email/SMS, analytics, search, dan monitoring.
- **Bangun sendiri** hanya untuk hal yang menjadi keunggulan kompetitif, atau kalau layanan jadi tidak memenuhi kebutuhan, biaya, atau regulasi.
- Hitung **TCO** (total cost of ownership): biaya pembuatan + maintenance + infrastruktur + waktu tim + risiko, dibandingkan dengan biaya langganan. Pertimbangkan juga vendor lock-in dan exit plan.

## 10. Pasar & kompetisi

- **Ukuran pasar:** TAM → SAM → SOM. Hitung secara **bottom-up**: jumlah calon pelanggan yang bisa dijangkau × harga × frekuensi. Jangan hanya mengutip angka laporan industri.
- **Positioning:** "Untuk [segmen] yang [masalah], [produk] adalah [kategori] yang [manfaat utama], tidak seperti [alternatif], karena [pembeda]."
- **Moat:** network effect, data eksklusif, switching cost, brand, skala/biaya lebih rendah, distribusi, atau regulasi.
- **Go-to-market:** channel mana yang paling murah untuk menjangkau segmen awal (komunitas, konten/SEO, partnership, direct sales, marketplace)? Fokus ke satu atau dua channel dulu.

## 11. Kepatuhan & risiko

- **Data pribadi:** patuhi **UU PDP (UU No. 27/2022)** untuk user di Indonesia, dan GDPR kalau melayani user di Eropa. Aturan dasarnya:
  - Punya dasar pemrosesan dan consent.
  - Kumpulkan data seminimal mungkin.
  - Beri hak user untuk mengakses dan menghapus datanya.
  - Siap memberi notifikasi kalau terjadi kebocoran.
- **Sektor khusus** punya regulasi sendiri: pembayaran/fintech (BI/OJK), kesehatan, dan pendidikan anak. Cek dulu sebelum membangun.
- Pertimbangkan juga risiko reputasi, ketergantungan pada satu platform (algoritma media sosial, marketplace, app store), dan ketergantungan pada satu pelanggan besar.

## 12. Menerjemahkan ke keputusan teknis

- Pilih solusi **paling sederhana yang cukup untuk tahap bisnis saat ini.** Jangan over-engineer sebelum ada traction. Arsitektur untuk 1 juta user tidak dibutuhkan saat user masih 100.
- Pasang **analytics dan event tracking sejak awal** supaya keputusan berbasis data.
- **Tech debt boleh diambil secara sadar** untuk mengejar validasi, asal dicatat dan dibayar sebelum menghambat.
- Hitung biaya teknis per unit (biaya server/AI per transaksi) dan masukkan ke perhitungan gross margin.

## 13. Format jawaban

```
**Rekomendasi:** <keputusan + 1 kalimat alasan>
**Asumsi kunci:** <yang harus benar supaya ini berhasil — mana yang paling berisiko>
**Angka:** <estimasi kasar dengan rentang: biaya, potensi pendapatan, unit economics>
**Metrik sukses:** <metrik utama + target + guardrail>
**Risiko:** <apa yang bisa gagal + mitigasinya>
**Langkah berikutnya:** <eksperimen/aksi konkret, yang termurah dulu, + kriteria lanjut/berhenti>
```

Terus terang kalau sebuah ide lemah. Jelaskan alasannya dengan data atau logika, lalu tawarkan alternatif atau cara memvalidasinya dengan murah.
