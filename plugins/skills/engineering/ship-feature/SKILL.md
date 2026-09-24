---
name: ship-feature
description: Titik masuk utama untuk mengerjakan fitur, perubahan, atau bugfix dari awal sampai selesai dengan satu perintah, memakai agent doz-agent secara hemat token. Mengukur pekerjaan (kecil/sedang/besar), lalu menjalankan hanya agent yang dibutuhkan (product-owner → kontrak API → backend-engineer ∥ frontend-engineer → code-reviewer ∥ qa-tester ∥ security-tester → acceptance), termasuk loop perbaikan, dan hanya berhenti untuk keputusan bisnis. Pakai saat user bilang "kerjain/tambahin/bikin fitur X", "ship", "sampai selesai", "end-to-end", atau memanggil /ship-feature. Jangan dipakai kalau user hanya mau diskusi, analisis, atau review tanpa implementasi.
argument-hint: "[--engineer-model opus|sonnet] <deskripsi fitur/perubahan>"
effort: high
---

# Ship Feature

Kamu (thread utama) adalah orkestrator. Selesaikan permintaan berikut sampai tuntas dengan agent **sesedikit mungkin** tanpa menurunkan kualitas.

**Permintaan:** $ARGUMENTS

Kalau bagian di atas kosong, pakai permintaan user di pesan terakhir.

Permintaan diawali `--engineer-model <opus|sonnet>` → itu eksperimen model, bukan bagian dari permintaan. Setiap panggilan baru ke engineer memakai model itu lewat parameter `model` di tool `Agent`. Hasilnya dibandingkan nanti dengan `/doz-agent:token-audit --compare`.

Agent tidak bisa memanggil agent lain. Semua agent kamu panggil lewat tool `Agent` dengan `subagent_type` `doz-agent:<nama>`. User tidak perlu memilih agent.

## Aturan berpikir & output

Ini yang menentukan hemat atau borosnya seluruh alur:

- **Sizing dibatasi ~5 pembacaan file.** Setelah ukuran ditentukan, jangan dianalisis ulang.
- **Jangan memanggil agent untuk hal yang bisa kamu kerjakan sendiri dengan konteks yang sudah kamu punya.** Setiap agent membayar eksplorasi dari nol. Menulis kontrak, brief, atau perubahan kecil sendiri hampir selalu lebih murah.
- **Update ke user maksimal 2 baris per tahap.** Tanpa narasi rencana, tanpa "sekarang saya akan…", tanpa menempel diff atau isi file. Laporan lengkap hanya sekali di akhir.
- **Jangan meneruskan laporan agent utuh ke agent lain.** Rujuk file spec, ringkas sisanya jadi poin yang dibutuhkan penerima. Konteks thread utama dikirim ulang tiap giliran — itu biaya yang berlipat.
- Tanpa task-list untuk alur di bawah 3 langkah.

## 1. Ukur pekerjaan (sendiri, tanpa agent)

`CLAUDE.md` sudah ada di konteksmu (yang di subfolder ikut dimuat saat file di sana dibaca), jadi jangan dibaca ulang. Eksplorasi secukupnya (dalam batas di atas), lalu simpan temuanmu untuk diteruskan ke agent berikutnya.

| Ukuran | Ciri | Alur |
|---|---|---|
| **Kecil** | 1–3 file, satu layer, tanpa perubahan kontrak API/skema DB, tidak menyentuh area sensitif* | Kerjakan **sendiri tanpa agent**, jalankan test terkait, selesai |
| **Sedang** | Requirement sudah jelas, tidak ada keputusan bisnis baru | Lewati product-owner. Kontrak (langkah 3) → engineer → verifikasi |
| **Besar** | Fitur baru, aturan bisnis baru, requirement masih kabur, atau menyentuh area sensitif* | product-owner → kontrak (langkah 3) → engineer → verifikasi → acceptance |

\* Area sensitif: auth/session, role/authorization, input user ke DB/command, upload, payment, data pribadi, webhook, secret.

Sampaikan ukuran + alasannya dalam **satu kalimat**, lalu langsung lanjut.

## 2. Product owner (hanya Besar)

Panggil `doz-agent:product-owner` dengan permintaan user, path project, dan temuanmu. PO bekerja **sekali jalan** — jangan memanggilnya dua kali untuk requirement yang sama.

- `[WAJIB DIJAWAB]` → tanyakan dengan `AskUserQuestion` (maksimal 4 sekaligus, default PO jadi opsi pertama), lalu lanjut.
- `[ASUMSI]` → pakai apa adanya, catat untuk laporan akhir.
- Ikuti **Rencana agent** dari PO.

## 3. Brief kerja bersama

Satu file `docs/specs/<slug>.md` jadi acuan semua agent, supaya tidak ada yang menjelajahi repo dari nol.

```markdown
## Konteks repo
<stack, perintah build/test/lint, path penting, konvensi — dari langkah 1>
## Requirement
<user story + AC, atau permintaan user kalau tanpa PO>
## Kontrak API
### <METHOD> <path>
- Auth · Request (params/body + validasi) · Response 2xx (contoh JSON) · Error (status → kapan → contoh body)
## Peta file
### Backend / ### Frontend
- <path> — <buat/ubah> — <apa> (ikuti pola: <path:baris>)
## Keputusan & asumsi
```

Siapa yang menulisnya:

| Kondisi | Cara |
|---|---|
| **Default** (1–2 endpoint, pola API di project sudah jelas) | **Tulis sendiri.** Kamu sudah punya konteksnya; cukup cek satu endpoint serupa sebagai acuan konvensi |
| ≥3 endpoint, ada migration/perubahan skema, atau domainnya rumit | Panggil `doz-agent:system-analyst`. Biaya eksplorasinya sepadan dengan risiko rework |
| Bentuk response belum bisa dipastikan, atau porsi FE sangat kecil | **Lewati kontrak di depan.** `backend-engineer` dulu, ambil kontrak final dari laporannya, baru `frontend-engineer` |
| Hanya satu layer (FE saja atau BE saja) | Tanpa kontrak. Cukup "Konteks repo" + "Requirement" + "Peta file" |

**Peta file wajib diisi** — itu yang membatasi scope engineer dan mencegah eksplorasi ulang. Pertanyaan terbuka yang memengaruhi kontrak diperlakukan seperti langkah 2.

## 4. Eksekusi

- Kontrak sudah ada → panggil `backend-engineer` dan `frontend-engineer` **paralel dalam satu pesan**.
- Beri setiap engineer `name` unik saat dipanggil (misalnya `be-<slug>`, `fe-<slug>`) supaya bisa dilanjutkan nanti.
- Prompt ke engineer cukup pendek: path project, path spec, bagian yang dikerjakan, perintah build/test, dan "jangan membaca kode sisi lain; jangan menjelajahi ulang area yang sudah dijelaskan spec; jangan mengedit file spec".
- Engineer wajib menjalankan **self-review** dan menyertakan **Peta AC → test** di laporannya. Laporan tanpa peta itu, atau dengan suite penuh yang belum dijalankan → kembalikan dulu ke engineer, jangan lanjut ke verifikasi.
- **Baca baris pertama laporan engineer (`Status:`) dulu:** `done` → lanjut · `needs-decision` → putuskan sendiri, atau tanya user kalau menyangkut bisnis · `blocked` → selesaikan penghalangnya atau laporkan ke user · `too-big` → pecah sesuai usulannya.
- **Lanjutkan engineer yang sama, jangan panggil baru,** setelah `needs-decision` dijawab, `blocked` selesai, pecahan pertama `too-big` diputuskan, laporannya ditandai partial karena `maxTurns`, atau laporannya dikembalikan. Kirim lewat `SendMessage` ke `name`-nya (atau agentId-nya). Konteksnya (eksplorasi, keputusan, kode yang sudah ditulis) masih utuh, dan kalau belum lewat 1 jam cache-nya ikut terpakai, jadi engineer tidak mulai dari nol.
- Engineer punya memory peta kode per project, jadi fitur yang areanya pernah disentuh akan jauh lebih cepat. Tetap tulis Peta file — memory itu petunjuk, bukan pengganti brief.
- `devops-engineer` hanya kalau ada env/config/CI/deploy baru.
- Engineer melaporkan kontrak yang tidak bisa diimplementasikan → **kamu** yang memutuskan perubahannya (tanya user kalau menyangkut bisnis), perbarui spec, lalu kabari engineer sisi lain.

## 5. Verifikasi (paralel, satu pesan)

Scope tiap agent: file yang berubah + acceptance criteria + path spec + **baris Verifikasi dari laporan engineer** (hasil build/test), supaya reviewer dan QA tidak menjalankan ulang suite yang sudah hijau. Ke `qa-tester` sertakan juga **Peta AC → test** dari laporan engineer, supaya QA menguji celahnya, bukan mengulang test yang sudah ada.

| Agent | Kapan |
|---|---|
| `code-reviewer` | Selalu (Sedang & Besar) |
| `qa-tester` | Ada logika baru/berubah atau acceptance criteria. FE ∥ BE → minta cek integrasi sesuai Kontrak API. Lewati untuk perubahan murni tampilan/copy |
| `security-tester` | Hanya kalau menyentuh area sensitif |

## 6. Loop perbaikan

- **Tunggu semua agent verifikasi selesai**, lalu gabungkan temuan blocking (🔴 dari reviewer, bug QA, security Critical/High, ketidaksesuaian kontrak) jadi **satu batch per engineer**. **Salin baris temuannya apa adanya** (`CR-1 path:line: …`, `QA-BUG-1 …`, `SEC-1 …`), tanpa ditulis ulang. Satu panggilan per engineer, bukan satu per temuan.
- Pilih cara mengirim batch ke engineer:
  - Ada temuan yang butuh pemahaman desain (kontrak, alur lintas file, pendekatan yang salah) → **lanjutkan engineer yang sama** lewat `SendMessage`. Ia masih ingat kenapa kodenya ditulis begitu.
  - Semua temuan lokal dan `path:line`-nya jelas → **panggilan baru**. Konteks lama engineer yang besar tidak perlu ikut dibaca ulang di setiap turn perbaikan.
- Prompt perbaikan diawali **"Mode perbaikan"**, supaya engineer menambah regression test, menjalankan ulang suite penuh + self-review, dan menyimpan pola temuannya di memory.
- Verifikasi ulang **hanya oleh agent yang menemukannya**, lewat **panggilan baru** dengan scope hanya perbaikannya: kirim ID temuan + baris status dari engineer. Jangan lanjutkan verifikator lama: konteksnya besar dan cache 5 menitnya sudah kedaluwarsa.
- **Maksimal 2 putaran.** Masih ada blocking → berhenti dan laporkan ke user.
- Temuan non-blocking tidak diperbaiki otomatis; masuk laporan akhir.

## 7. Acceptance (hanya Besar)

Panggil `doz-agent:product-owner` mode Acceptance dengan path spec, daftar file berubah, dan **ringkasan** hasil verifikasi.

## 8. Gate sebelum melapor selesai

Jangan bilang selesai sebelum: build/lint/test **benar-benar dijalankan** (bukan diasumsikan), setiap acceptance criteria punya status, dan tidak ada temuan blocking yang tersisa. Ada yang tidak bisa dijalankan → sebutkan eksplisit.

## 9. Laporan akhir

```
## Selesai: <fitur>
Ukuran: <Kecil/Sedang/Besar> · Agent: <daftar> · Spec: <path / tidak ada>

## Yang berubah
- <file/area>: <ringkasan>

## Verifikasi
Build/test: <hasil> · Review: <keputusan> · Security: <hasil / tidak diperlukan> · Acceptance: <Accept/Reject / tidak diperlukan>

## Asumsi & catatan non-blocking
- ...
```

## 10. Token audit (Sedang & Besar)

Setelah laporan akhir, panggil `doz-agent:token-audit` lewat tool `Skill` tanpa argumen. Tampilkan hasilnya di bawah laporan akhir apa adanya. Script-nya membaca transcript workflow ini, lalu melaporkan token per agent, gap terbesar, kegagalan & temuan per kategori, pola kegagalan berulang, dan saran perbaikan. Audit gagal → satu baris alasannya, lalu lanjut. Ukuran Kecil dilewati: tanpa agent tidak ada yang perlu diaudit, dan output-nya hanya menambah konteks.

Setelah itu, di semua ukuran, tanyakan apakah user mau commit. **Jangan commit atau push tanpa izin.**

## Hemat token di sisi user

Sebutkan hanya kalau relevan, sekali saja:

- `CLAUDE.md` tidak ada di folder yang dikerjakan → sarankan `/init` di sana.
- Fitur besar yang bisa dipecah → tawarkan potongan vertikal pertama dulu daripada satu rantai penuh.
- Setelah fitur selesai → session baru untuk fitur berikutnya lebih murah daripada melanjutkan session panjang.
