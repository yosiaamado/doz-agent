---
name: engineering-workflow
description: Alur kerja tim software profesional (SDLC). Mencakup Definition of Ready/Done, branching, Conventional Commits, ukuran & deskripsi PR, etika code review, SemVer & release, ADR, tech debt, serta incident & postmortem. Pakai saat memulai atau menyelesaikan task, membuat commit/branch/PR, menulis deskripsi PR atau changelog, mencatat keputusan arsitektur, atau menangani insiden.
---

# Engineering Workflow

Cara tim engineering profesional bekerja dari tiket sampai production. Kalau project atau tim punya proses sendiri (template PR, format commit, branching), **ikuti punya mereka**.

## 1. Siklus kerja

```
Tiket (Ready) → Desain singkat → Branch → Kode + Test → PR → Review + CI hijau → Merge → Deploy → Verifikasi di production → Done
```

Prinsip utamanya:
- **Perubahan kecil dan sering** lebih aman daripada perubahan besar yang jarang.
- **Otomatisasi** semua yang bisa diotomatisasi: lint, test, build, dan deploy.
- **"Selesai" artinya jalan di production dan terverifikasi**, bukan cuma "kode sudah ditulis".

## 2. Definition of Ready (sebelum mulai)

Sebuah task siap dikerjakan kalau:
- [ ] Tujuan dan alasan bisnisnya jelas (kenapa ini dikerjakan).
- [ ] Acceptance criteria bisa diuji. Pakai format **Given / When / Then** kalau memungkinkan.
- [ ] Scope jelas, termasuk apa yang **tidak** dikerjakan.
- [ ] Dependency (API, desain, akses, data) sudah tersedia atau diketahui.
- [ ] Cukup kecil untuk selesai dalam beberapa hari. Kalau lebih, pecah dulu.

Kalau ada yang kurang, **tanyakan dulu** sebelum menulis kode. Salah paham requirement adalah pemborosan terbesar.

## 3. Desain sebelum kode

- **Task kecil:** cukup rencana singkat berisi file yang diubah dan pendekatannya.
- **Task besar atau berisiko** (skema data, kontrak API publik, arsitektur, security): tulis design doc singkat berisi konteks, opsi, keputusan, dan risiko. Minta persetujuan dulu.
- Keputusan arsitektur penting dicatat sebagai **ADR** (lihat bagian 9).

## 4. Branching

- **Trunk-based development:** `main` selalu bisa di-deploy. Branch umurnya pendek (idealnya < 2 hari), lalu di-merge lewat PR.
- Nama branch: `<tipe>/<id-tiket>-<deskripsi-singkat>`. Contoh: `feat/SHOP-123-checkout-voucher`, `fix/SHOP-130-double-charge`.
- Fitur yang belum selesai boleh di-merge asal disembunyikan di balik **feature flag**. Jangan menumpuk long-lived branch.
- Jangan pernah force-push ke `main` atau branch bersama.

## 5. Commit (Conventional Commits)

```
<tipe>(<scope>): <ringkasan imperatif, huruf kecil, tanpa titik>

<body: kenapa perubahan ini dibuat, bukan apa yang diubah>

<footer: Refs: SHOP-123 | BREAKING CHANGE: ...>
```

| Tipe | Kapan |
|---|---|
| `feat` | Fitur baru untuk user |
| `fix` | Perbaikan bug |
| `refactor` | Ubah struktur tanpa ubah perilaku |
| `perf` | Peningkatan performa |
| `test` | Menambah atau memperbaiki test |
| `docs` | Dokumentasi |
| `build` / `ci` | Build system atau pipeline |
| `chore` | Pekerjaan rutin (update dependency, dll.) |

Aturannya:
- **Satu commit = satu perubahan logis.** Jangan campur refactor dengan fitur.
- Ringkasan maksimal ±72 karakter.
- Tambahkan `!` atau footer `BREAKING CHANGE:` untuk perubahan yang merusak kompatibilitas.
- **Jangan commit** secret, file build, `.env`, atau kode yang di-comment-out.
- Commit dan push hanya dilakukan kalau user memintanya.

## 6. Pull Request

**Ukuran:** idealnya < 400 baris perubahan (di luar file generated/lock). PR besar dipecah jadi beberapa PR yang bisa di-review terpisah.

**Template deskripsi:**

```markdown
## Kenapa
<masalah / tujuan, link tiket>

## Apa yang berubah
- <poin perubahan utama>

## Cara test
- <langkah verifikasi manual + test otomatis yang ditambah>

## Risiko & rollback
- <dampak, migration, feature flag, cara rollback>

## Screenshot (kalau ada perubahan UI)
```

Sebelum minta review:
- [ ] CI hijau: lint, type-check, test, build.
- [ ] Self-review diff sendiri dulu.
- [ ] Tidak ada debug log, TODO tanpa tiket, atau kode mati.
- [ ] Dokumentasi, `.env.example`, dan changelog di-update kalau perlu.

## 7. Code review

- **Tujuannya meningkatkan kesehatan codebase, bukan mencari kode sempurna.** Approve kalau perubahan jelas membuat kode lebih baik, walaupun belum ideal.
- **Urutan fokus:** desain → kebenaran → kompleksitas → test → penamaan → komentar → gaya.
- **Beri label di setiap komentar** (Conventional Comments):
  - `issue (blocking):` harus diperbaiki sebelum merge
  - `suggestion:` saran perbaikan, tidak wajib
  - `question:` minta penjelasan
  - `nit:` hal kecil atau gaya, tidak wajib
  - `praise:` hal yang bagus
- Kritik kodenya, bukan orangnya, dan jelaskan **alasan**nya.
- Gaya dan format yang bisa diotomatisasi diserahkan ke linter/formatter, bukan diperdebatkan di review.

## 8. Definition of Done

Sebuah task **selesai** kalau:
- [ ] Semua acceptance criteria terpenuhi dan terverifikasi.
- [ ] Ada test otomatis untuk perilaku baru dan bug yang diperbaiki (regression test).
- [ ] Lint, type-check, test, dan build lulus.
- [ ] Sudah di-review dan di-approve.
- [ ] Tidak ada masalah security yang diketahui. Input divalidasi dan authorization dicek.
- [ ] Logging dan metric memadai untuk debugging di production.
- [ ] Dokumentasi (README, API docs, runbook, ADR) di-update.
- [ ] Sudah di-deploy dan diverifikasi, atau siap di-deploy dengan langkah rollback yang jelas.

## 9. ADR (Architecture Decision Record)

Simpan di `docs/adr/NNNN-judul.md`. Satu keputusan per file, dan jangan diubah setelah diterima. Kalau keputusannya berubah, buat ADR baru yang menggantikannya.

```markdown
# NNNN. <Judul keputusan>

- Status: Proposed | Accepted | Superseded by NNNN
- Tanggal: YYYY-MM-DD

## Konteks
<masalah, batasan, dan faktor yang memengaruhi>

## Keputusan
<apa yang dipilih>

## Opsi yang dipertimbangkan
<opsi lain + alasan tidak dipilih>

## Konsekuensi
<dampak positif, negatif, dan hal yang harus diikuti ke depan>
```

## 10. Versioning & release

- **SemVer:** `MAJOR.MINOR.PATCH`.
  - MAJOR: ada breaking change.
  - MINOR: fitur baru yang kompatibel.
  - PATCH: perbaikan bug.
- `CHANGELOG.md` mengikuti format Keep a Changelog: Added, Changed, Deprecated, Removed, Fixed, Security.
- Rilis ditandai dengan git tag (`v1.4.0`). Artefak dibangun sekali lalu dipromosikan antar environment (dev → staging → prod).
- Fitur yang mau dihapus diberi status **deprecated** dulu dengan jangka waktu yang jelas, baru dihapus.

## 11. Tech debt

- Tech debt boleh diambil **secara sadar**, tapi harus dicatat sebagai tiket berisi dampak, perkiraan biaya perbaikan, dan pemicu kapan harus dibayar.
- Terapkan **boy scout rule:** tinggalkan kode sedikit lebih rapi dari sebelumnya, asal masih dalam scope PR.
- `TODO` di kode wajib menyertakan ID tiket: `// TODO(SHOP-140): ...`

## 12. Incident & postmortem

**Tingkat severity:**

| Level | Contoh | Respons |
|---|---|---|
| SEV1 | Layanan utama mati, data bocor, pembayaran gagal massal | Semua hands-on sekarang, update berkala ke stakeholder |
| SEV2 | Fitur penting rusak, belum ada workaround | Ditangani segera di jam kerja maupun on-call |
| SEV3 | Fitur rusak tapi ada workaround | Dijadwalkan di sprint berjalan |
| SEV4 | Kosmetik, dampak kecil | Masuk backlog |

**Saat insiden:**
1. **Pulihkan dulu, baru investigasi.** Rollback, matikan feature flag, atau scale.
2. Satu orang memimpin (incident commander), dan ada satu channel komunikasi.
3. Catat timeline selama insiden berlangsung.

**Postmortem** wajib untuk SEV1–SEV2, dengan prinsip **blameless** (fokus ke sistem, bukan menyalahkan orang). Isinya:
- Ringkasan dampak
- Timeline
- Root cause (5 Whys)
- Apa yang berjalan baik dan apa yang tidak
- Action item yang punya pemilik dan tenggat
