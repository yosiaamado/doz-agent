# doz studio

Editor visual (kotak + garis, ala n8n) dan runner lokal untuk workflow doz-agent. Tidak ikut ter-install sebagai plugin. Jalankan dari clone repo ini.

## Fitur

- **Palet komponen** (kiri): agent, skill, action, dan node alur (start, condition, approval, catatan, output). Seret ke canvas atau klik dua kali. Tombol `+` membuat agent/skill/action baru, ikon pensil membuka editornya, dan **Folder yang dibaca** mengatur dari folder mana komponen dimuat.
- **Canvas ala Figma**: scroll = geser, Ctrl/⌘ + scroll atau pinch = zoom, Space + drag atau klik tengah = geser, drag di area kosong = pilih banyak. Grid titik abu-abu gelap seperti n8n. Catatan (sticky note) bisa di-resize.
- **Status realtime**: node yang sedang jalan berwarna **biru** (berdenyut) dan garis menuju node itu biru beranimasi. Node dan garis yang sudah dilewati berwarna **hijau**, cabang yang tidak dipilih redup. Di bawah node tampil aktivitas terakhir (mis. `Edit: src/x.ts`), durasi live, token, jumlah eksekusi, dan jumlah file yang diubah.
- **Logs** (bawah): pohon node sesuai urutan eksekusi. Klik node (di canvas atau di pohon) untuk melihat:
  - **Info**: status, jam mulai/selesai, durasi, token (input/output/cache), biaya, turns, model, runner, dan tabel **riwayat** tiap eksekusi node (loop/retry).
  - **Input**: prompt lengkap yang dikirim. **Output**: hasil agent.
  - **File**: daftar file yang ditambah/diubah/dihapus node itu (+/−). Diff lama vs baru baru dimuat saat kamu memilih file (atau "Semua diff").
  - **Command**: perintah `claude -p …` persis yang dijalankan (bisa disalin), atau perintah shell untuk action.
  - **Aktivitas**: log tool call dan teks agent.
- **Executions** (tab atas): riwayat run per workflow, termasuk run dari Claude Code. Pilih satu untuk melihat warnanya di canvas.
- **Pengaturan** (kanan): per node (runner, model, effort, izin, input, max turns, timeout, retry, budget, instruksi) atau per workflow (ikon gerigi).
- **Dua otak**: `claude-cli` (login Claude Code, lewat `claude -p`) atau `api` (`ANTHROPIC_API_KEY`).
- **Run dari terminal ikut tampil**: `/doz-agent:run-workflow` menulis progres ke `.doz-studio/runs/`, dan studio membacanya.

## Edit agent / skill: konsepnya

| Mau mengubah | Tempat | Berlaku untuk |
|---|---|---|
| Perilaku agent/skill secara umum (prompt, tools, model bawaan) | Editor komponen (ikon pensil) → menulis file `.md`-nya | Semua workflow + pemakaian lewat Claude Code |
| Perilaku di satu langkah saja | Panel kanan node: *Instruksi untuk langkah ini*, model, izin, dll. | Node itu saja (disimpan di file workflow) |

Editor punya mode **Form** (mengubah key frontmatter satu per satu; key lain dan komentar tetap) dan **Raw** (seluruh isi file). Editor menampilkan workflow mana saja yang memakai komponen itu. File di `plugins/` adalah bagian plugin, jadi catat perubahannya di `CHANGELOG.md`.

## Folder yang dibaca

Bawaan: `plugins/agents`, `plugins/skills`, `plugins/actions`, `plugins/workflows`, ditambah `{workdir}/.claude/agents|skills|workflows` (agent/skill project). Bisa ditambah folder lain, misalnya `~/.claude/agents`. Folder paling atas jadi tujuan file baru. Kalau ada nama yang sama di dua folder, yang di atas yang dipakai. Konfigurasi disimpan di `studio/.local.json`.

## Menjalankan

Butuh Node 20+. Runner `claude-cli` butuh `claude` di PATH. Runner `api` butuh `ANTHROPIC_API_KEY`. Diff per node butuh folder project berupa repo git (tanpa git, yang tampil hanya daftar file yang ditulis agent).

```bash
cd studio
npm install
npm run build
npm start -- --workdir /path/ke/project-kamu     # buka http://localhost:4317
```

- `--workdir`: folder project tempat agent bekerja. Bisa diganti dari UI (ikon folder di kanan atas).
- `--port` atau `DOZ_STUDIO_PORT`: port lain (bawaan 4317).
- `npm run dev`: server + Vite hot reload di http://localhost:5317.
- `npm test`: test engine, library, snapshot git, dan argumen CLI.

## Cara kerja

```
web/ (React + React Flow) ──HTTP/WebSocket──► server/ (Node, hanya 127.0.0.1)
                                               ├─ workflow.js   parse/serialize/validasi file workflow
                                               ├─ library.js    baca/tulis agent, skill, action dari folder sumber
                                               ├─ engine.js     eksekusi graph: paralel, condition, loop, approval, budget
                                               ├─ gitdiff.js    snapshot working tree sebelum/sesudah node (index sementara)
                                               ├─ runners/claude-cli.js  claude -p --agents … --agent … --plugin-dir plugins
                                               ├─ runners/api.js         Claude API + tool lokal (tools.js, path dikurung di workdir)
                                               ├─ runners/shell.js       node action
                                               └─ runs.js       log JSONL di <workdir>/.doz-studio/runs/ + pantau run dari luar
```

- **Perubahan file per node**: sebelum dan sesudah node jalan, studio menyalin index git ke file sementara, menjalankan `git add -A` ke index itu, lalu `write-tree`. Index, branch, dan stash kamu tidak disentuh. Selisih dua tree = file yang diubah node itu. Kalau dua node jalan paralel, perubahan keduanya bisa tercatat di masing-masing node.
- Agent dimuat langsung dari file `.md` (`--agents`), dan `--plugin-dir plugins` membuat skill `doz-agent:*` tersedia walau plugin belum ter-install. Mode `-p` tidak bisa menanyakan izin, jadi tools agent diizinkan di depan (`--allowedTools`) dan edit memakai `--permission-mode acceptEdits`. Pakai `permission: read-only` untuk agent yang tidak boleh mengubah apa pun.
- Token live diambil dari `usage` tiap pesan di stream; angka final dari event `result`.
- Server hanya listen di `127.0.0.1` dan menolak Host/Origin selain localhost. File komponen hanya bisa ditulis ke folder sumber yang terdaftar.
