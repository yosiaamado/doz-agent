# Changelog

Semua perubahan berarti pada plugin `doz-agent` dicatat di sini, versi terbaru di atas. Versi mengikuti `plugins/.claude-plugin/plugin.json` (SemVer).

Aturan untuk manusia dan AI yang mengubah repo ini:

- Setiap versi = satu entri: alasan/sumber, lalu satu baris per perubahan per file. Commit-nya diberi tag `vX.Y.Z`.
- Kembali ke versi lama: `git checkout vX.Y.Z -- plugins/` (atau `git revert <commit>`). Membandingkan: `git diff vX.Y.Z..HEAD -- plugins/`.
- Perubahan yang dipicu audit pemakaian menyebut file di `agent-usage/`, supaya dampaknya bisa dibandingkan dengan audit berikutnya.
- Riwayat sebelum 1.15.0: lihat `git log`.

## [1.19.0] - 2026-09-28

Sumber: permintaan user supaya bisa push dan pull ke GitHub langsung dari Doz Studio.

### Studio

- `server/services/gitService.js` + `routes/gitRoutes.js` (baru): status (branch, upstream, ahead/behind, file berubah, commit terakhir), fetch, pull (`--rebase --autostash`), commit semua perubahan, push (membuat upstream kalau belum ada, tidak pernah force). Target `repo` (doz-agent) atau `workdir` (project aktif). Token di URL remote dan pesan git disamarkan. `GIT_TERMINAL_PROMPT=0` supaya server tidak menunggu password.
- `web/src/features/dialogs/GitDialog.jsx` (baru) + tombol GitHub di top bar dengan badge jumlah file berubah; push minta konfirmasi lewat modal; setelah pull/commit di repo doz-agent, daftar agent/skill/workflow dimuat ulang.
- Test: `test/git.test.js` memakai remote bare lokal (commit → push → pull di clone lain, autostash, branch tanpa upstream, penyamaran token). Total 39 test.
- `plugin.json`: versi 1.19.0.

## [1.18.0] - 2026-09-28

Sumber: masukan user untuk UI studio (16 poin: snap grid, dropdown modern, logo/favicon, menu hover, tema terang/gelap, lampiran dokumen, usage Claude Code, modal pengganti alert, pemilih folder, dll.) dan permintaan menerapkan pola [everything-claude-code](https://github.com/worldflowai/everything-claude-code) supaya FE modern dan BE readable/SOLID. File agent tidak berubah.

### Studio: backend (`studio/server/`)

- Dipecah per lapisan: `app.js` (composition root), `http/` (router, middleware localhost, respons `{ success, data | error }`, skema zod, static, socket), `routes/`, `services/`, `repositories/`, `domain/`, `runners/`, `infra/`, `lib/`.
- Engine dipecah jadi `graph.js` (fungsi murni), `executors.js` (per tipe node), `engine.js` (orkestrasi); state run tidak dimutasi.
- Perbaikan bug engine: node yang baru siap setelah node lain di-skip dalam putaran yang sama tidak lagi terlewat (mis. jalur "aman" di audit).
- Runner `claude-cli`: prompt lewat stdin, definisi agent lewat file sementara (argumen pendek, aman di Windows `claude.cmd`), merekam `rate_limit_event`.
- Baru: lampiran dokumen (`/api/attachments`, teks md/txt/kode/docx disisipkan, pdf/gambar lewat path), pemakaian Claude Code (`/api/usage`: batas 5 jam & 7 hari + token lokal dari `~/.claude/projects`), penjelajah folder (`/api/folders`).
- Logger JSON terstruktur, `ApiError` + error handler terpusat, tool `bash` runner API memakai `shell.js` yang sama.
- Test: 34 (unit, integrasi API, runner dengan `claude` palsu, template workflow), coverage baris ±89%.

### Studio: frontend (`studio/web/`)

- Tema gelap & terang (ikut sistem atau manual), token warna di `styles/tokens.css`.
- Logo baru (robot + alur 4 langkah) di menu dan favicon.
- Menu kiri: rail ikon yang melebar saat di-hover dan menyempit saat ditinggal; tab Editor | Executions di dalam menu; bisa drag-drop di layar kecil; tag "edit" dihapus.
- Canvas: snap to grid 20px, geser dengan klik kiri, Shift+drag pilih banyak.
- Dropdown (Select/Combobox) dan modal (confirm/prompt) sendiri, bisa dipakai dengan keyboard; `alert`/`confirm`/`prompt` bawaan dihapus.
- Pemilih folder ala file manager untuk folder project dan folder sumber; top bar tidak lagi bertumpuk di layar kecil.
- Dialog run bisa melampirkan dokumen; widget pemakaian Claude Code di top bar; dialog Workflow Baru dari template.
- Judul memakai Title Case; struktur per fitur (`components/ui`, `features/*`, `hooks`, `lib`, `state`, `styles`), dialog di-lazy-load, ErrorBoundary.

### Plugin

- `plugins/workflows/`: template baru `perbaikan-bug`, `fitur-lengkap`, `audit-keamanan`, `rilis`.
- `plugin.json`: versi 1.18.0.
- `.gitignore`: `studio/.usage.json`.

## [1.17.0] - 2026-09-28

Sumber: permintaan user untuk UI studio ala n8n (abu-abu gelap, canvas geser ala Figma), status aktif biru/selesai hijau sampai ke garis, kelola agent/skill/action dari UI, detail per node (token, durasi, riwayat, diff file, command CLI). File agent tidak berubah.

### Studio (`studio/`)

- UI ditulis ulang gaya n8n: palet kiri (cari, seret, `+` baru, pensil edit, folder sumber), tab Editor/Executions, canvas grid titik dengan navigasi Figma, node kotak berlabel di bawah + node agent lebar, sticky note bisa di-resize, tombol Jalankan melayang.
- Status run: node jalan biru berdenyut + garis biru beranimasi, node/garis yang sudah dilewati hijau, cabang yang tidak dipilih redup; durasi live, token live, jumlah eksekusi, jumlah file di bawah node.
- Panel Logs: pohon node + detail per node (Info + riwayat eksekusi, Input, Output, File + diff yang dimuat saat dipilih, Command CLI yang bisa disalin, Aktivitas).
- Editor komponen: buat/edit agent, skill, action (mode Form mengubah key frontmatter satu per satu, mode Raw seluruh file), menampilkan workflow yang memakainya.
- Folder sumber bisa diatur (`plugins/*`, `{workdir}/.claude/*`, `~/.claude/*`, dll.).
- Node baru `action`: perintah shell di folder project, exit code 0 = PASS, dibaca langsung oleh condition.
- Server: `library.js` (baca/tulis komponen dari banyak folder), `gitdiff.js` (snapshot working tree per node lewat index sementara), `runners/shell.js`; runner mengirim command yang ditampilkan, token live, dan file yang ditulis; `claude -p` memakai `--plugin-dir plugins`.

### Plugin

- `plugins/actions/` (baru): `cek-perubahan.md`, `jalankan-test.md`.
- `plugins/workflows/README.md`: node `action`, ukuran sticky note, format action tersimpan.
- `skills/engineering/run-workflow/SKILL.md`: menjalankan node action lewat Bash; condition memakai exit code action.
- `plugin.json` & `marketplace.json`: versi 1.17.0.

## [1.16.0] - 2026-09-28

Sumber: permintaan user untuk GUI ala n8n (kotak + garis) agar alur agent bisa dirancang, diatur, dan dipantau realtime, dengan otak dari Claude Code atau API key. Alur disimpan sebagai file workflow terpisah; file agent tidak berubah.

### Workflow (`plugins/workflows/`, baru)

- `README.md`: spesifikasi format (node start/agent/skill/condition/approval/info/output, edge `when`/`loop`, pengaturan node > defaults > agent > bawaan, log progres `.doz-studio/runs/`).
- `fitur-kecil.md`: contoh PO → BE → QA dengan loop perbaikan maks 2x dan node info.
- `review-pr.md`: contoh code review ∥ security review (read-only) → approval manusia.

### Skill (`plugins/skills/engineering/`)

- `run-workflow/SKILL.md` (baru): menjalankan file workflow dari Claude Code tanpa studio (paralel, condition via VERDICT, loop, approval via AskUserQuestion) dan menulis progres JSONL untuk studio.

### Studio (`studio/`, baru, tidak ikut ter-install)

- Server Node lokal (127.0.0.1): engine graph (paralel, cabang, loop, approval, retry, timeout, budget), runner `claude-cli` (`claude -p --agents/--agent`, stream-json) dan `api` (Claude API + tool lokal yang dikurung di workdir), log run JSONL + pemantau run dari terminal.
- UI React Flow: palet agent/skill/node, panel pengaturan per node dan workflow, status/aktivitas/biaya per kotak secara realtime, panel log & output, tombol approval.
- `npm test`: test engine, validasi, pengaturan, argumen CLI, dan sandbox tool API.

### Lainnya

- `README.md`: bagian Workflow visual, skill `run-workflow`, struktur `studio/` dan `plugins/workflows/`.
- `plugin.json` & `marketplace.json`: versi 1.16.0, 12 skill.
- `.gitignore`: `studio/node_modules`, `studio/web/dist`, `studio/.local.json`, `.doz-studio/`.

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
