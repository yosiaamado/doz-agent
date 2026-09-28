# Doz Studio

Editor visual (kotak + garis, ala n8n) dan runner lokal untuk workflow doz-agent. Tidak ikut ter-install sebagai plugin. Jalankan dari clone repo ini.

## Fitur

- **Tampilan**: tema **gelap** (abu-abu ala n8n) dan **terang**, bisa ikut sistem (ikon monitor/matahari/bulan di kanan atas). Logo juga dipakai sebagai favicon.
- **Menu kiri yang bisa melebar**: saat menyempit hanya berupa rail ikon. Saat kursor diarahkan ke sana, menu melebar di atas canvas, lalu menyempit lagi saat kursor pergi. Isinya: tab **Editor | Executions**, pencarian, lalu komponen **Agent / Skill / Action / Alur**. Komponen bisa diseret ke canvas (juga di layar kecil) atau diklik dua kali. `+` membuat file baru, ikon pensil mengedit file.
- **Canvas**: node menempel ke grid 20px. Drag dengan klik kiri atau tengah menggeser layar. Scroll juga menggeser, Ctrl/⌘ + scroll atau pinch untuk zoom, dan Shift + drag untuk memilih banyak node. Catatan (sticky note) bisa di-resize.
- **Status realtime**: node yang sedang jalan **biru** dan garis menuju node itu biru beranimasi. Node dan garis yang sudah dilewati **hijau**, cabang yang tidak dipilih redup. Di bawah node tampil aktivitas terakhir, durasi live, token, jumlah eksekusi, dan jumlah file yang diubah.
- **Logs**: pohon node dan detail per node:
  - **Info**: status, waktu, durasi, token, biaya, model, dan riwayat tiap eksekusi.
  - **Input**: prompt lengkap, termasuk dokumen lampiran.
  - **Output**.
  - **File**: diff lama vs baru yang dimuat saat file dipilih.
  - **Command**: perintah `claude -p` persis.
  - **Aktivitas**.
- **Dokumen di permintaan**: saat menjalankan workflow, lampirkan PRD/spec/catatan (md, txt, docx, pdf, gambar, file kode). Teks disisipkan ke prompt. PDF dan gambar dibaca agent lewat tool Read.
- **Pemakaian Claude Code**: batas sesi 5 jam dan mingguan (dari `rate_limit_event` yang dikirim `claude -p`) plus total token lokal dari `~/.claude/projects`. Tombol Refresh memakai satu panggilan haiku kecil.
- **Pilih folder ala file manager**: folder project dan folder sumber dipilih lewat penjelajah folder, tidak perlu mengetik path. Tampilannya tetap pendek (`{workdir}/…`, `~/…`, `plugins/…`).
- **Dropdown, modal, dan konfirmasi** memakai komponen sendiri yang bisa dipakai dengan keyboard. Tidak ada `alert`/`confirm` bawaan browser.
- **Workflow baru** bisa dimulai kosong atau dari workflow/template yang ada (`fitur-kecil`, `fitur-lengkap`, `perbaikan-bug`, `audit-keamanan`, `review-pr`, `rilis`).

## Edit agent / skill: konsepnya

| Mau mengubah | Tempat | Berlaku untuk |
|---|---|---|
| Perilaku agent/skill secara umum (prompt, tools, model bawaan) | Editor komponen (ikon pensil) → menulis file `.md`-nya | Semua workflow + pemakaian lewat Claude Code |
| Perilaku di satu langkah saja | Panel kanan node: *Instruksi untuk Langkah Ini*, model, izin, dll. | Node itu saja (disimpan di file workflow) |

Editor punya dua mode. **Form** mengubah key frontmatter satu per satu (key lain dan komentar tetap), sedangkan **Raw** mengedit seluruh isi file. Editor menampilkan workflow mana saja yang memakai komponen itu dan meminta konfirmasi kalau kamu menutupnya dengan perubahan yang belum disimpan.

## Menjalankan

Butuh Node 20+. Runner `claude-cli` butuh `claude` di PATH (termasuk `claude.cmd` di Windows). Runner `api` butuh `ANTHROPIC_API_KEY`. Diff per node butuh folder project berupa repo git.

```bash
cd studio
npm install
npm run build
npm start -- --workdir /path/ke/project-kamu     # buka http://localhost:4317
```

- `--workdir` bisa diganti dari UI (tombol folder di kanan atas). Pilihan disimpan di `studio/.local.json`.
- `--port` atau `DOZ_STUDIO_PORT`: port lain (bawaan 4317). `DOZ_LOG_LEVEL=debug` untuk log lebih rinci.
- `npm run dev`: server + Vite hot reload di http://localhost:5317.
- `npm test`: 34 test (unit + integrasi API + template workflow), coverage baris ±89% (`node --test --experimental-test-coverage`).

## Arsitektur

Mengikuti pola dari [everything-claude-code](https://github.com/worldflowai/everything-claude-code) (coding-style, backend/frontend patterns): lapisan terpisah, satu tanggung jawab per file, state tidak dimutasi, input divalidasi, error ditangani terpusat.

```
server/
├─ index.js            entry: listen + banner
├─ app.js              composition root: merakit config → repository → service → route (dependency injection)
├─ http/               router, middleware (hanya localhost), respond ({ success, data | error }), schemas (zod), static, socket
├─ routes/             systemRoutes, libraryRoutes, runRoutes: tipis, hanya validasi + panggil service
├─ services/           workflowService, runService, usageService, folderService, attachmentService
├─ repositories/       componentRepository (agent/skill/action/workflow di banyak folder), runLogRepository (JSONL)
├─ domain/             engine (orkestrasi), executors (per tipe node), graph (fungsi murni), prompt, workflow, timeout
├─ runners/            claude-cli (prompt via stdin, agent via file), api (Claude API + tool lokal), shell, tools, activity
├─ infra/              config (workdir, folder sumber), gitdiff (snapshot per node)
└─ lib/                errors (ApiError), logger (JSON terstruktur), paths, frontmatter

web/src/
├─ App.jsx             merangkai layout; dialog di-lazy-load
├─ components/ui/      Select, Combobox, Modal, Dialogs (confirm/prompt), Toast, Segmented, Field, Logo, ErrorBoundary
├─ features/           topbar, sidebar, canvas, settings, logs, dialogs (per fitur)
├─ hooks/              useWorkflowEditor, useRuns, useLibrary, useTheme, useNow, useDebounce, useClickOutside
├─ lib/                api (klien + WebSocket), model (fungsi murni: konversi, reducer run, warna garis), storage
├─ state/              studioContext
└─ styles/             tokens (tema gelap/terang), base, ui, layout, canvas, logs, dialogs
```

- **API**: semua respons `{ success, data }` atau `{ success: false, error, details }`. Input divalidasi zod dan error tak terduga disembunyikan (500 + log).
- **Perubahan file per node**: snapshot working tree lewat index git sementara sebelum dan sesudah node (index, branch, dan stash kamu tidak disentuh). Diff dimuat saat dipilih.
- **Runner claude-cli**: prompt lewat stdin dan definisi agent lewat file sementara, jadi argumen CLI pendek dan aman di Windows. `--plugin-dir plugins` membuat skill `doz-agent:*` tersedia walau plugin belum ter-install. Mode `-p` tidak bisa menanyakan izin, jadi tools agent diizinkan di depan. Pakai `permission: read-only` untuk agent yang tidak boleh mengubah apa pun.
- **Keamanan**: server hanya listen di `127.0.0.1` dan menolak Host/Origin selain localhost. File komponen hanya bisa ditulis ke folder sumber yang terdaftar, dan path tool API dikurung di workdir.
