# Changelog

Semua perubahan berarti pada plugin `doz-agent` dicatat di sini, versi terbaru di atas. Versi mengikuti `plugins/.claude-plugin/plugin.json` (SemVer).

Aturan untuk manusia dan AI yang mengubah repo ini:

- Setiap versi = satu entri: alasan/sumber, lalu satu baris per perubahan per file. Commit-nya diberi tag `vX.Y.Z`.
- Kembali ke versi lama: `git checkout vX.Y.Z -- plugins/` (atau `git revert <commit>`). Membandingkan: `git diff vX.Y.Z..HEAD -- plugins/`.
- Perubahan yang dipicu audit pemakaian menyebut file di `agent-usage/`, supaya dampaknya bisa dibandingkan dengan audit berikutnya.
- Riwayat sebelum 1.15.0: lihat `git log`.

## [1.15.0] - 2026-09-25

Sumber: audit satu workflow `ship-feature` besar (8 permintaan, 4 slice, BE+FE, ≈ $41), lihat [`agent-usage/2026-09-25.md`](agent-usage/2026-09-25.md). Masalah utama: 6x agent berhenti di `maxTurns` tanpa laporan, engineer menerima 4 slice sekaligus tanpa `too-big`, lanjutan lewat SendMessage ±$13, dan bug yang lolos self-review. Semua perubahan bersifat umum (bukan untuk satu project). Frontmatter agent tidak berubah.

### Agent (`plugins/agents/`)

- `backend-engineer.md`: checkpoint turn ±35 tool call → laporan `Status: partial`; cek too-big kuantitatif (>1 slice atau >~15 file non-test); `blocked: env` dan `blocked: tidak bisa reproduksi` di Verifikasi; self-review: kolom status baru → grep semua query entity, AC ≥2 kondisi diuji per kondisi, endpoint agregat pakai permission resource asal; template Status + `partial`.
- `frontend-engineer.md`: checkpoint turn ±35 → `partial`; cek too-big kuantitatif; `blocked: env`/tidak bisa reproduksi; self-review: AC ≥2 kondisi, state map di-merge, override style (inline style vs `:hover`), data by id lewat endpoint by id; template Status + `partial`.
- `devops-engineer.md`: checkpoint turn ±28 → `partial`; template Status + `partial`.
- `product-owner.md`: budget pencarian dikaitkan ke checkpoint ±10 tool call.
- `system-analyst.md`: checkpoint turn ±17; kerangka spec (heading + slice) ditulis di awal; template spec punya bagian `Slice`, tag `[S1]` di Peta file, dan pemilik file kalau >1 engineer per layer; rencana eksekusi satu panggilan engineer per slice.
- `code-reviewer.md`: diff >~25 file → file logika dulu; checkpoint turn ±17 → laporan dengan `Belum direview`.
- `security-tester.md`: checkpoint turn ±21 → laporan dengan `Belum direview`; A01 + endpoint agregat; A08 + prototype pollution (key dari user).
- `qa-tester.md`: checkpoint turn ±28; env tidak tersedia/tidak bisa reproduksi masuk `Belum ter-cover`; AC ≥2 kondisi = satu test per kondisi; `Rekomendasi` + `Belum bisa diputuskan`.

### Skill (`plugins/skills/engineering/`)

- `ship-feature/SKILL.md`: langkah 1 minta user login di browser kalau ada AC visual dan tool browser (tanpa browser → "belum dicek visual"); template brief punya `Slice` dan tag slice di Peta file; pemilik file kalau >1 engineer per layer; satu panggilan engineer = satu slice, paralel hanya kalau Peta file tidak beririsan; status `partial` dilanjutkan lewat SendMessage; diff >~25 file → code-reviewer dipecah per layer/modul.
- `frontend-patterns/SKILL.md` §9: lookup objek dengan key dari user pakai `Map`/`Set`/`Object.hasOwn`.
- `backend-patterns/SKILL.md`: §2 batas bawah dan atas untuk semua query param numerik (400) + offset tanpa overflow; §4 response DTO hanya berisi field yang dipakai konsumen.
- `backend-patterns/references/dotnet.md`: contoh `CreateAsync` tidak lagi memakai `BeginTransactionAsync` langsung (bentrok dengan `EnableRetryOnFailure`); aturan transaksi manual lewat `CreateExecutionStrategy().ExecuteAsync`; pagination divalidasi batas `page` dan `pageSize`.
- `token-audit/SKILL.md`: fallback `python` kalau `python3` tidak ada; dokumentasi label `(lanjutan-maxTurns)`/`(slice berikutnya)`, status maxTurns, dan kategori baru.

### Script `token-audit/scripts/token_audit.py`

- Output dipaksa UTF-8 (`reconfigure`), jadi tidak crash `UnicodeEncodeError` di console Windows cp1252.
- Regex `Status:` mengenal `partial`.
- Run yang mentok `maxTurns` (notifikasi "N-turn limit", atau jumlah turn di batas tanpa baris Status/keputusan) tampil sebagai "⚠ berhenti di maxTurns", masuk sinyal "Hampir kehabisan turn", dan punya saran sendiri.
- Label lanjutan: setelah maxTurns → `(lanjutan-maxTurns)`; setelah `done` dengan prompt berisi "slice" → `(slice berikutnya)`. Keduanya tidak dihitung "laporan dikembalikan".
- Kategori temuan: dicocokkan dari teks tanpa label severity dan di awal kata (sebelumnya `"lock"` cocok dengan "blocking", `"race"` dengan "traceId", sehingga banyak temuan salah masuk transaksi/concurrency). Kategori baru `authz-agregat`, `state-update`, `css-cascade` di urutan paling atas.
- `max_turns_of` menutup file yang dibaca.

### Repo

- `plugins/.claude-plugin/plugin.json`: versi 1.14.0 → 1.15.0.
- Baru: `CHANGELOG.md` (file ini), `agent-usage/README.md` (format log pemakaian), `agent-usage/2026-09-25.md` (audit yang memicu versi ini).
- `README.md`: struktur repo + `CHANGELOG.md`, `agent-usage/`, `tests/`; status `partial` dan checkpoint turn di Format laporan; langkah rilis menulis entri changelog dan tag.

### Test

- Baru: `tests/test_token_audit.py` (12 test: kategori, label lanjutan, status maxTurns, output cp1252). Jalankan: `python3 -m unittest discover -s tests`.
