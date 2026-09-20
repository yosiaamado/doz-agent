---
name: product-ownership
description: Teknik Product Owner profesional (Scrum Guide 2020 + praktik industri) - dimensi analisis dampak, user story INVEST, acceptance criteria Given/When/Then, story splitting vertikal, Definition of Ready, prioritas backlog, dan penerimaan hasil. Pakai saat mendiskusikan fitur baru, minta "impact-nya apa", "bikin user story", "acceptance criteria", "refinement", atau "scope MVP". Ini referensi teknik; alur kerja dan format laporan diatur agent product-owner.
effort: high
---

# Product Ownership

PO **memaksimalkan nilai produk**: menetapkan Product Goal, membuat item backlog yang jelas, mengurutkannya, dan menjaganya transparan.

PO memutuskan **apa** dan **kenapa**. Tim engineering memutuskan **bagaimana**. PO tidak mendikte implementasi, tapi wajib memastikan requirement cukup jelas untuk dikerjakan tanpa menebak.

## 1. Urutan berpikir

1. **Masalahnya apa?** Siapa yang mengalami, seberapa sering, apa buktinya, dan apa yang terjadi kalau tidak dibangun?
2. **Mendekatkan ke Product Goal?** Kalau tidak, katakan terus terang.
3. **Kondisi sekarang.** Jangan berasumsi fitur belum ada — cek dulu.
4. **Dampak** (bagian 2) → **scope** (MVP / nanti / non-goal) → **story + AC** (bagian 3–4).

## 2. Dimensi dampak

Periksa semua, **tulis hanya yang terdampak**:

| Dimensi | Pertanyaan |
|---|---|
| **User** | Role mana yang terdampak? Alur apa yang berubah? Ada yang dirugikan? |
| **Bisnis** | Metrik apa yang diharapkan naik? Guardrail apa yang tidak boleh turun? |
| **Frontend** | Halaman, komponen, state, routing mana yang berubah? |
| **Backend** | Endpoint, service, job, integrasi mana yang berubah? Breaking change ke klien lain? |
| **Data** | Tabel/kolom baru? Migration? Data lama perlu backfill? |
| **Keamanan & privasi** | Auth, role, data pribadi (UU PDP), payment, upload? |
| **Operasional** | Config/env baru, feature flag, monitoring, perubahan deploy? |
| **Dependensi** | Bergantung fitur lain, pihak ketiga, atau keputusan yang belum diambil? |

Tutup dengan **risiko** (rendah/sedang/tinggi) dan **ukuran kasar** (S/M/L/XL).

## 3. User story (INVEST)

**Sebagai** <role spesifik>, **saya ingin** <kemampuan>, **supaya** <manfaat>.

- **I**ndependent — bisa dirilis tanpa menunggu story lain.
- **N**egotiable — menjelaskan kebutuhan, bukan implementasi.
- **V**aluable — nilainya terlihat oleh user atau bisnis.
- **E**stimable — cukup jelas untuk diestimasi.
- **S**mall — selesai 1–3 hari kerja.
- **T**estable — jelas kapan dianggap selesai.

## 4. Acceptance criteria

```
Skenario: <nama>
Given <kondisi awal>
When <aksi>
Then <hasil yang bisa diamati>
```

Wajib mencakup: happy path · validasi gagal (kosong, format salah, batas maksimum) · hak akses (401, 403, data milik orang lain) · empty state, 404, error server · aturan bisnis spesifik.

Hindari kriteria yang tidak bisa diuji ("cepat", "user friendly"). Ubah jadi terukur: "hasil tampil < 1 detik untuk 1.000 produk".

## 5. Definition of Ready

- [ ] Masalah dan nilainya jelas, terkait Product Goal.
- [ ] AC lengkap dan bisa diuji.
- [ ] Desain UI/alur ada, atau cukup dijelaskan teks.
- [ ] Kontrak API disepakati (untuk fitur FE + BE).
- [ ] Dependensi dan pertanyaan terbuka sudah terjawab **atau punya default yang dipakai**.
- [ ] Ukurannya kecil. Kalau tidak, pecah (bagian 6).

## 6. Story splitting

Pecah **vertikal** — tiap potongan tetap bernilai end-to-end, bukan per lapisan teknis:

- **Alur kerja:** langkah minimal dulu, variasi belakangan.
- **Aturan bisnis:** aturan umum dulu, pengecualian belakangan.
- **Variasi data:** satu jenis dulu (misalnya satu metode bayar).
- **CRUD:** buat + lihat dulu, ubah + hapus belakangan.
- **Happy path dulu,** edge case jadi story terpisah kalau besar.
- **Spike:** ketidakpastian teknis → story riset berbatas waktu dulu.

## 7. Prioritas

- Urutkan berdasarkan nilai, risiko, dependensi, dan biaya. RICE/WSJF/MoSCoW ada di skill `business-thinking` kalau perlu membandingkan beberapa item.
- Kerjakan yang paling berisiko atau paling tidak pasti lebih awal supaya cepat belajar.
- Setiap item yang masuk berarti ada yang tidak dikerjakan. Sebutkan trade-off-nya.

## 8. Penerimaan hasil

- Cek tiap AC satu per satu: **lolos / gagal / belum bisa dicek**.
- Keputusan: **Accept** · **Accept dengan catatan** (sisa kecil jadi backlog) · **Reject** (sebutkan kriteria yang gagal).
- Catat metrik yang dipantau setelah rilis dan kapan dievaluasi.
