# doz studio

Editor visual (kotak + garis, ala n8n) dan runner lokal untuk workflow doz-agent. Tidak ikut ter-install sebagai plugin. Jalankan dari clone repo ini.

- **Canvas**: tarik agent, skill, condition, approval, info, dan output dari palet, sambungkan dengan garis, lalu atur tiap node di panel kanan.
- **Simpan** = menulis `plugins/workflows/<nama>.md`. File itu tetap bisa dijalankan tanpa studio lewat `/doz-agent:run-workflow`. Format: [`plugins/workflows/README.md`](../plugins/workflows/README.md).
- **Jalankan**: setiap kotak menampilkan status (menunggu / berjalan / selesai / gagal / dilewati / butuh keputusan), tool yang sedang dipakai agent, biaya, token, dan durasi. Log per node dan output lengkap ada di panel bawah.
- **Dua otak**: `claude-cli` (login Claude Code, lewat `claude -p`) atau `api` (`ANTHROPIC_API_KEY`). Bisa dipilih per workflow atau per node.
- **Run dari terminal ikut tampil**: `run-workflow` di Claude Code menulis progres ke `.doz-studio/runs/`, dan studio membacanya realtime.

## Menjalankan

Butuh Node 20+. Runner `claude-cli` butuh `claude` di PATH. Runner `api` butuh `ANTHROPIC_API_KEY`.

```bash
cd studio
npm install
npm run build
npm start -- --workdir /path/ke/project-kamu     # buka http://localhost:4317
```

- `--workdir`: folder project tempat agent bekerja. Bisa diganti dari UI (ikon folder di kanan atas) dan tersimpan di `studio/.local.json`. Tanpa flag ini, yang dipakai adalah folder tempat `npm` dipanggil.
- `--port` atau `DOZ_STUDIO_PORT`: port lain (bawaan 4317).
- `npm run dev`: server + Vite hot reload di http://localhost:5317, untuk mengubah UI.
- `npm test`: test engine (graph, loop, cabang, approval, budget, argumen CLI, sandbox tool API).

## Cara kerja

```
web/ (React + React Flow) ──HTTP/WebSocket──► server/ (Node, hanya 127.0.0.1)
                                               ├─ workflow.js   parse/serialize/validasi file .md
                                               ├─ engine.js     eksekusi graph: paralel, condition, loop, approval, budget
                                               ├─ runners/claude-cli.js  claude -p --agents … --agent … --output-format stream-json
                                               ├─ runners/api.js         Claude API + tool lokal (tools.js, path dikurung di workdir)
                                               └─ runs.js       log JSONL di <workdir>/.doz-studio/runs/ + pantau run dari luar
```

- Agent dimuat langsung dari `plugins/agents/*.md` (`--agents`), jadi plugin tidak perlu ter-install di project target. Mode `-p` tidak bisa menanyakan izin, jadi tools agent diizinkan di depan (`--allowedTools`) dan edit memakai `--permission-mode acceptEdits`. Pakai `permission: read-only` untuk agent yang tidak boleh mengubah apa pun.
- Prompt tiap node = catatan workflow + permintaan + node info yang tersambung + output node sebelumnya (sesuai `inputs`, dipotong `max_output_chars`) + umpan balik loop + instruksi node.
- Server hanya listen di `127.0.0.1` dan menolak Host/Origin selain localhost.
