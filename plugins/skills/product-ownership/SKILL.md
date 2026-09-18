---
name: product-ownership
description: Kerangka kerja Product Owner profesional (Scrum Guide 2020 + praktik industri). Mencakup Product Goal, analisis dampak fitur (user, bisnis, teknis, data, risiko), user story INVEST, acceptance criteria Given/When/Then, story splitting, Definition of Ready, prioritas & pengurutan backlog, pemecahan task ke frontend/backend dengan kontrak API di depan, serta penerimaan hasil (accept/reject). Pakai saat user mau mendiskusikan fitur baru, minta "impact-nya apa", "breakdown task", "bikin user story", "acceptance criteria", "refinement", "scope MVP", atau mau membagi kerjaan ke agent FE dan BE.
---

# Product Ownership

Product Owner (PO) **bertanggung jawab memaksimalkan nilai produk** dari pekerjaan tim. Caranya lewat pengelolaan Product Backlog yang efektif:

1. Menetapkan dan mengomunikasikan **Product Goal**.
2. Membuat dan mengomunikasikan item backlog dengan jelas.
3. **Mengurutkan** item backlog.
4. Memastikan backlog transparan, terlihat, dan dipahami tim.

PO memutuskan **apa** dan **kenapa**. Tim engineering memutuskan **bagaimana**. PO tidak mendikte implementasi, tapi wajib memastikan requirement cukup jelas untuk dikerjakan.

## 1. Alur diskusi fitur

Saat user membawa ide fitur, jangan langsung menulis task. Jalankan urutan ini:

1. **Pahami masalahnya.** Siapa yang mengalami, masalah apa, seberapa sering, dan apa buktinya? Apa yang terjadi kalau fitur ini tidak dibangun?
2. **Cek terhadap Product Goal.** Apakah fitur ini mendekatkan produk ke tujuannya? Kalau tidak, katakan terus terang.
3. **Pelajari kondisi sekarang.** Baca `CLAUDE.md`, struktur project, model data, endpoint, dan halaman yang terkait. Jangan berasumsi fitur belum ada.
4. **Analisis dampak** (bagian 2).
5. **Ajukan pertanyaan terbuka** yang keputusannya ada di tangan user (aturan bisnis, siapa yang boleh akses, batasan). Beri rekomendasi untuk setiap pertanyaan supaya user tinggal setuju atau menolak.
6. **Tentukan scope:** MVP (Must) vs nanti (Should/Could) vs tidak dikerjakan (Won't / non-goal).
7. **Tulis user story + acceptance criteria** (bagian 3–4).
8. **Pecah jadi task FE/BE** (bagian 6), lalu cek Definition of Ready (bagian 5).

## 2. Analisis dampak

Isi setiap dimensi. Tulis "tidak ada" kalau memang tidak berdampak, jangan dilewati.

| Dimensi | Pertanyaan |
|---|---|
| **User** | Segmen/role mana yang terdampak? Alur apa yang berubah? Ada user yang dirugikan? |
| **Bisnis** | Metrik apa yang diharapkan naik (dan berapa)? Guardrail apa yang tidak boleh turun? Pengaruh ke pendapatan/biaya? |
| **Frontend** | Halaman, komponen, state, dan routing mana yang berubah atau baru? |
| **Backend** | Endpoint, service, job, dan integrasi mana yang berubah atau baru? Ada breaking change ke klien lain? |
| **Data** | Tabel/kolom baru? Migration? Data lama perlu diisi ulang (backfill)? |
| **Keamanan & privasi** | Menyentuh auth, role, data pribadi (UU PDP), payment, atau upload? |
| **Operasional** | Perlu config/env baru, feature flag, monitoring, atau perubahan deploy? |
| **Dependensi** | Bergantung pada fitur lain, pihak ketiga, atau keputusan yang belum diambil? |

Tutup dengan **tingkat risiko** (rendah/sedang/tinggi) dan **estimasi ukuran kasar** (S/M/L/XL) beserta alasannya.

## 3. User story

Format: **Sebagai** <role spesifik>, **saya ingin** <kemampuan>, **supaya** <manfaat/nilai>.

Setiap story harus memenuhi **INVEST**:

- **Independent:** bisa dikerjakan dan dirilis tanpa menunggu story lain sebisa mungkin.
- **Negotiable:** menjelaskan kebutuhan, bukan spesifikasi implementasi.
- **Valuable:** memberi nilai yang terlihat ke user atau bisnis.
- **Estimable:** cukup jelas untuk diestimasi.
- **Small:** selesai dalam satu sprint (idealnya 1–3 hari kerja).
- **Testable:** ada kriteria jelas kapan dianggap selesai.

## 4. Acceptance criteria

Pakai format **Given / When / Then**, satu skenario per perilaku:

```
Skenario: <nama>
Given <kondisi awal>
When <aksi user/sistem>
Then <hasil yang bisa diamati>
```

Wajib mencakup:

- Happy path.
- Validasi gagal (input kosong, format salah, batas maksimum).
- Hak akses: tidak login (401), role tidak berhak (403), data milik orang lain.
- Data kosong (empty state), tidak ditemukan (404), dan error jaringan/server.
- Aturan bisnis spesifik (batas jumlah, status yang boleh berpindah, dll.).

Hindari kriteria yang tidak bisa diuji seperti "cepat" atau "user friendly". Ubah jadi terukur, misalnya "hasil tampil < 1 detik untuk 1.000 produk".

## 5. Definition of Ready

Story siap dikerjakan kalau:

- [ ] Masalah dan nilai jelas, terkait Product Goal.
- [ ] Acceptance criteria lengkap dan bisa diuji.
- [ ] Desain UI/alur ada, atau cukup dijelaskan dengan teks.
- [ ] Kontrak API disepakati (untuk fitur FE + BE).
- [ ] Dependensi dan pertanyaan terbuka sudah terjawab.
- [ ] Ukuran cukup kecil. Kalau tidak, pecah dulu (bagian 7).

## 6. Pemecahan task ke frontend & backend

Aturan:

- **Kontrak API di depan.** Tulis method, path, request, response, error, dan authorization sebelum FE/BE mulai. Dengan kontrak ini FE bisa jalan paralel dengan mock.
- **Urutan umum:** BE (skema + API) → FE (integrasi). Kalau kontrak sudah fix, FE boleh mulai paralel pakai data mock.
- Setiap task punya: tujuan, file/area yang kemungkinan disentuh, acceptance criteria yang relevan, dan dependensi.
- Task harus bisa diserahkan ke agent tanpa konteks tambahan. Tulis brief-nya lengkap.

Format brief per task:

```
### [BE-1] <judul>
Agent: backend-engineer
Tujuan: <1-2 kalimat>
Konteks: <project, stack, file/area terkait>
Kontrak API: <method, path, request, response, error, auth>
Perubahan data: <tabel/kolom/migration>
Acceptance criteria: <daftar skenario yang harus lolos>
Dependensi: <task lain / tidak ada>
Di luar scope: <yang tidak boleh dikerjakan>
```

Agent tersedia untuk eksekusi:

| Agent | Tugas |
|---|---|
| `backend-engineer` | API, service, DB, migration |
| `frontend-engineer` | UI, komponen, state, integrasi API |
| `devops-engineer` | Config/env, CI/CD, deploy, infra |
| `qa-tester` | Test berdasarkan acceptance criteria |
| `security-tester` | Audit kalau menyentuh auth/input/data pribadi/payment |
| `code-reviewer` | Review sebelum commit/merge |

## 7. Story splitting

Kalau story terlalu besar, pecah secara **vertikal** (tiap potongan tetap memberi nilai end-to-end), bukan per lapisan teknis. Pola:

- **Alur kerja:** langkah minimal dulu, variasi belakangan.
- **Aturan bisnis:** aturan paling umum dulu, pengecualian belakangan.
- **Variasi data/input:** satu jenis dulu (misalnya satu metode bayar).
- **Operasi CRUD:** buat + lihat dulu, ubah + hapus belakangan.
- **Happy path dulu,** penanganan edge case sebagai story terpisah kalau besar.
- **Spike:** kalau ada ketidakpastian teknis, buat story riset berbatas waktu dulu.

## 8. Prioritas & pengurutan

- Urutkan berdasarkan nilai, risiko, dependensi, dan biaya. Pakai RICE/WSJF/MoSCoW dari skill `business-thinking` kalau perlu membandingkan beberapa item.
- Kerjakan item berisiko tinggi atau yang paling tidak pasti lebih awal supaya cepat belajar.
- Setiap item yang masuk berarti ada yang tidak dikerjakan. Sebutkan trade-off-nya.

## 9. Penerimaan hasil

Setelah fitur selesai dikerjakan:

- Cek setiap acceptance criteria satu per satu: **lolos / gagal / belum bisa dicek**.
- Keputusan: **Accept**, **Accept dengan catatan** (sisa kecil jadi item backlog baru), atau **Reject** (sebutkan kriteria yang gagal).
- Catat metrik yang harus dipantau setelah rilis dan kapan dievaluasi.

## 10. Format keluaran

```
## Ringkasan fitur
<masalah, untuk siapa, nilai yang diharapkan>

## Analisis dampak
<tabel bagian 2 + risiko + estimasi ukuran>

## Pertanyaan terbuka
1. <pertanyaan> — Rekomendasi: <jawaban yang disarankan + alasan>

## Scope
- MVP: ...
- Nanti: ...
- Non-goal: ...

## User story & acceptance criteria
<story + skenario Given/When/Then>

## Metrik sukses
<metrik utama + target + guardrail>

## Kontrak API
| Method | Path | Request | Response | Error | Auth |

## Rencana task
<brief per task (bagian 6), urutan & mana yang bisa paralel>

## Definition of Ready
<checklist bagian 5 — mana yang belum terpenuhi>
```
