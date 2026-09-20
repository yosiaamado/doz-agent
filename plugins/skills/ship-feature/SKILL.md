---
name: ship-feature
description: Titik masuk utama untuk mengerjakan fitur, perubahan, atau bugfix dari awal sampai selesai dengan satu perintah, memakai agent doz-agent secara hemat token. Mengukur pekerjaan (kecil/sedang/besar), lalu menjalankan hanya agent yang dibutuhkan (product-owner → kontrak API → backend-engineer ∥ frontend-engineer → code-reviewer ∥ qa-tester ∥ security-tester → acceptance), termasuk loop perbaikan, dan hanya berhenti untuk keputusan bisnis. Pakai saat user bilang "kerjain/tambahin/bikin fitur X", "ship", "sampai selesai", "end-to-end", atau memanggil /ship-feature. Jangan dipakai kalau user hanya mau diskusi/analisis tanpa implementasi.
argument-hint: <deskripsi fitur/perubahan>
---

# Ship Feature

Kamu (thread utama) adalah orkestrator. Selesaikan permintaan berikut sampai tuntas dengan agent sesedikit mungkin tanpa menurunkan kualitas:

**Permintaan:** $ARGUMENTS

Agent tidak bisa memanggil agent lain. Semua agent dipanggil olehmu lewat tool `Agent` dengan `subagent_type` `doz-agent:<nama>`. User tidak perlu memilih agent; kamu yang menentukan berdasarkan alur di bawah dan rencana dari product-owner/system-analyst.

## 1. Ukur pekerjaan (sendiri, tanpa agent)

Baca `CLAUDE.md` dan eksplorasi **secukupnya** untuk menentukan ukuran. Simpan temuanmu (file, baris, pola) untuk diteruskan ke agent berikutnya.

| Ukuran | Ciri | Alur |
|---|---|---|
| **Kecil** | 1–3 file, satu layer, tanpa perubahan kontrak API/skema DB, tidak menyentuh area sensitif* | Kerjakan **sendiri tanpa agent**, jalankan test terkait, selesai |
| **Sedang** | Requirement sudah jelas, tidak ada keputusan bisnis baru | Lewati product-owner. Tentukan kontrak (langkah 3) → engineer → verifikasi |
| **Besar** | Fitur baru, aturan bisnis baru, requirement masih kabur, atau menyentuh area sensitif* | product-owner → kontrak API (langkah 3) → engineer → verifikasi → acceptance |

\* Area sensitif: auth/session, role/authorization, input user ke DB/command, upload, payment, data pribadi, webhook, secret.

Sampaikan ukuran + alasannya dalam satu kalimat, lalu langsung lanjut.

## 2. Product owner (hanya Besar)

Panggil `doz-agent:product-owner` mode Refinement dengan permintaan user, path project, dan temuanmu.

- Pertanyaan **"wajib dijawab user"** → tanyakan dengan `AskUserQuestion` (maksimal 4 pertanyaan sekaligus, sertakan rekomendasi PO sebagai opsi pertama), lalu lanjut.
- Pertanyaan **"memakai rekomendasi"** → pakai rekomendasinya, catat sebagai asumsi.
- Ikuti **Rencana agent** dari PO.

## 3. Kontrak API (kalau fitur menyentuh FE + BE)

Kontrak harus ada **sebelum** engineer mulai, supaya FE tidak perlu membaca kode BE. Tapi kontrak tidak selalu perlu agent sendiri — memanggil agent berarti satu eksplorasi codebase lagi dari nol, padahal kamu sudah melakukannya di langkah 1.

| Kondisi | Cara |
|---|---|
| **Default** (1–2 endpoint, pola API di project sudah jelas) | **Tulis kontraknya sendiri** ke `docs/specs/<slug>.md`. Kamu sudah punya konteksnya; cukup cek satu endpoint serupa sebagai acuan konvensi (path, penamaan field, envelope, format error, auth). |
| ≥3 endpoint, ada migration/perubahan skema, atau domainnya rumit | Panggil `doz-agent:system-analyst`. Biaya eksplorasinya sepadan dengan risiko rework. |
| Bentuk response belum bisa dipastikan (misalnya menunggu integrasi pihak ketiga), atau porsi FE sangat kecil | **Lewati kontrak di depan.** Jalankan `backend-engineer` dulu, ambil kontrak final dari laporannya, baru jalankan `frontend-engineer` dengan kontrak itu. |
| Fitur hanya satu layer (FE saja atau BE saja) | Tidak perlu kontrak. Tulis brief sendiri. |

Kalau ada pertanyaan terbuka yang memengaruhi kontrak, perlakukan seperti di langkah 2.

Isi minimal kontrak per endpoint: method, path, auth, request (params/body + validasi), contoh response 2xx, dan daftar error (status → kapan → contoh body). Tambahkan **Peta file** (file BE dan FE yang dibuat/diubah + pola yang diikuti, dengan `path:baris`) supaya engineer tidak menjelajahi ulang.

## 4. Eksekusi

- Kalau kontrak sudah ada, panggil `backend-engineer` dan `frontend-engineer` **paralel dalam satu pesan**. (Paralel menghemat waktu; yang menghemat token adalah kontraknya.)
- Prompt ke engineer cukup pendek karena detailnya ada di spec: path project, path spec, bagian yang dikerjakan, perintah build/test, dan "jangan membaca kode sisi lain; jangan menjelajahi ulang area yang sudah dijelaskan spec".
- Tanpa spec (satu layer): tulis brief sendiri berisi tujuan, file + baris, cuplikan pola, acceptance criteria, dan batas scope.
- `devops-engineer` hanya kalau ada env/config/CI/deploy baru.
- Kalau engineer melaporkan kontrak yang tidak bisa diimplementasikan: putuskan perubahannya (tanya user kalau menyangkut bisnis), perbarui spec, lalu kabari engineer sisi lain.

## 5. Verifikasi (paralel, satu pesan)

Scope setiap agent: file yang berubah + acceptance criteria + path spec (kalau ada).

| Agent | Kapan |
|---|---|
| `code-reviewer` | Selalu (Sedang & Besar) |
| `qa-tester` | Ada logika baru/berubah atau acceptance criteria. Kalau FE ∥ BE, minta juga cek integrasi sesuai Kontrak API. Lewati untuk perubahan murni tampilan/copy. |
| `security-tester` | Hanya kalau menyentuh area sensitif |

## 6. Loop perbaikan

- Temuan **blocking** (bug, `issue (blocking)`, security Critical/High, ketidaksesuaian kontrak): kirim ke engineer yang relevan dengan daftar temuan + file:line. Verifikasi ulang **hanya oleh agent yang menemukannya**, dengan scope hanya perbaikannya.
- Maksimal **2 putaran**. Kalau masih ada blocking, berhenti dan laporkan ke user.
- Temuan non-blocking tidak diperbaiki otomatis; masukkan ke laporan akhir.

## 7. Acceptance (hanya Besar)

Panggil `doz-agent:product-owner` mode Acceptance dengan path spec, daftar file yang berubah, dan ringkasan hasil verifikasi (bukan laporan lengkap).

## 8. Laporan akhir

```
## Selesai: <fitur>
Ukuran: <Kecil/Sedang/Besar> · Agent: <daftar> · Spec: <path / tidak ada>

## Yang berubah
- <file/area>: <ringkasan>

## Verifikasi
- Test/build: <hasil> · Review: <keputusan> · Security: <hasil / tidak diperlukan>
- Acceptance: <Accept/Reject / tidak diperlukan>

## Asumsi yang diambil
- ...

## Catatan non-blocking / TODO
- ...
```

Tanyakan apakah user mau commit. **Jangan commit atau push tanpa izin.**

## Aturan hemat token

- **Jangan memanggil agent untuk hal yang bisa kamu kerjakan sendiri dengan konteks yang sudah kamu punya.** Setiap agent membayar eksplorasi codebase dari nol. Menulis kontrak, brief, atau perubahan kecil sendiri hampir selalu lebih murah.
- Jangan meneruskan laporan agent utuh ke agent lain. Rujuk file spec, dan ringkas sisanya jadi poin yang dibutuhkan penerima.
- Ke user, tampilkan kemajuan per tahap dalam 1–2 kalimat, bukan laporan lengkap agent.
- Kalau `CLAUDE.md` di folder yang dikerjakan (misalnya folder FE) tidak ada, sarankan sekali ke user untuk menjalankan `/init` di sana. Itu menghemat eksplorasi di semua panggilan agent berikutnya.
- Fitur besar yang bisa dipecah: tawarkan mengerjakan potongan pertama dulu (vertical slice yang tetap bernilai) daripada satu rantai penuh yang panjang.
- Setelah fitur selesai, ingatkan user bahwa session baru untuk fitur berikutnya lebih murah daripada melanjutkan session yang sudah panjang.
