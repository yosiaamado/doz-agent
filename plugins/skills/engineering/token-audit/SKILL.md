---
name: token-audit
description: Audit token dan kegagalan satu workflow Claude Code dari transcript session — token dan perkiraan biaya per agent, gap terbesar (file besar dibaca utuh, output command panjang, eksplorasi panjang, cache miss, narasi, laporan panjang, putaran perbaikan), kegagalan agent (status blocked/tanpa status, temuan blocking per kategori, test/build gagal, temuan muncul lagi), pola kegagalan berulang lintas workflow, dan saran perbaikan per file agent. Dipanggil otomatis di akhir ship-feature. Pakai juga saat user bilang "token audit", "berapa token yang kepake", "kenapa boros", "agent mana yang paling mahal", atau memanggil /token-audit.
argument-hint: "[--workflow NAMA | --all | --since ISO-TIME | --transcript PATH | --compare]"
---

# Token & Failure Audit

Jalankan script di folder skill ini (lihat "Base directory for this skill" di atas):

```bash
python3 "<base directory skill ini>/scripts/token_audit.py" $ARGUMENTS
```

Tanpa argumen, script mengaudit **workflow `ship-feature` terakhir** di session terbaru project ini. Pilihan lain:

| Argumen | Scope |
|---|---|
| `--workflow <nama-skill>` | Workflow terakhir yang dimulai dengan skill itu |
| `--all` | Seluruh session |
| `--since 2026-09-23T10:00:00Z` | Sejak waktu tertentu (UTC) |
| `--transcript <path.jsonl>` | Transcript tertentu |
| `--compare` | Rata-rata biaya, putaran perbaikan, verifikasi ulang, temuan blocking, dan laporan dikembalikan per model engineer, dari semua workflow yang tercatat. Tidak membaca transcript |

## Aturan

- **Tampilkan output script apa adanya.** Jangan diringkas ulang, jangan dihitung ulang, jangan menambah tabel sendiri. Angka token berasal dari `usage` API di transcript (persis). Ukuran hasil tool dan dampak $ adalah perkiraan.
- Setelah output, tambahkan **maksimal 2 kalimat** hanya kalau ada hal yang tidak terlihat dari angka. Contoh: gap disebabkan permintaan user yang memang besar, bukan karena agent-nya boros.
- **Saran harus umum, bukan untuk satu project.** Agent ini dipakai di banyak project, jadi yang diperbaiki adalah cara kerja agent (aturan di `plugins/agents/*.md` atau skill pattern), bukan error project tertentu. Pelajaran khusus project sudah disimpan memory engineer saat Mode perbaikan. Baris `↳` hanya bukti penyebabnya.
- Kegagalan dengan penyebab **lingkungan** (DB mati, perintah tidak ada, jaringan) bukan kesalahan agent. Sarannya diarahkan ke `CLAUDE.md` project, bukan ke file agent.
- **Jangan mengubah file agent otomatis.** Tawarkan ke user untuk menerapkan saran yang paling berdampak.
- Script gagal atau transcript tidak ditemukan → laporkan pesan error-nya dalam satu baris, lalu lanjutkan. Audit tidak boleh memblokir workflow.

## Cara membaca hasil

- **% biaya per agent** menunjukkan agent mana yang paling layak dioptimasi.
- **Gap** diurutkan dari perkiraan dampaknya. Konten yang masuk konteks lebih awal dibaca ulang dari cache di setiap turn berikutnya, jadi satu file besar di awal bisa lebih mahal daripada banyak file kecil di akhir.
- **Kegagalan & temuan** dibaca dari format laporan agent: `Status:` engineer, `Keputusan:`/`Rekomendasi:` verifikator, baris temuan `CR-n`/`QA-BUG-n`/`SEC-n`, test/build yang gagal di dalam agent, engineer yang dipanggil ulang setelah `done` tanpa "Mode perbaikan", dan temuan blocking yang muncul lagi setelah diperbaiki. Agent yang tidak mengikuti format laporan akan tampil sebagai "⚠ tanpa baris Status/keputusan".
- **Agent background & run lanjutan**: laporan agent background dibaca dari `<task-notification>`, karena tool_result-nya hanya "Async agent launched". Run yang dilanjutkan lewat `SendMessage` dihitung sebagai panggilan, dengan label `(lanjutan)`, `(perbaikan)`, atau `(dikembalikan)`. Yang masuk "Dipanggil berulang" hanya run perbaikan dan verifikasi ulang, dan `maxTurns` dicek per run.
- **Kategori temuan** (test lama, null/no-op, loop/data korup, authorization, validasi, kontrak, dst.) ditebak dari kata kunci, jadi hasilnya kasar. Yang tidak cocok masuk "lain".
- **Bukti (`↳`)**: satu baris dari data asli per item, maksimal 2. Untuk test/build: baris error yang menentukan beserta penyebabnya (kompilasi/tipe, test gagal, lint, lingkungan). Untuk pola berulang: temuan aslinya beserta nama project.
- **Pola kegagalan berulang** muncul kalau kategori blocking yang sama untuk engineer yang sama terjadi di ≥2 dari 5 workflow terakhir. Kalau terjadi di beberapa project, itu tanda paling kuat bahwa kelemahannya ada di agent. Saran dari pola ini selalu ditampilkan paling atas.
- Test yang gagal sekali di tengah iterasi itu wajar. Saran per penyebab baru muncul kalau penyebabnya berulang, berakhir merah, atau berasal dari lingkungan.
- **Tren** muncul setelah ada minimal 2 run sebelumnya. Log disimpan di `~/.claude/doz-agent/token-audit.csv` (token), `findings.csv` (temuan), dan `runs.csv` (ringkasan per workflow, dipakai `--compare`).
- Harga $ adalah harga list API. Langganan Pro/Max tidak ditagih per token, jadi angka $ hanya pembanding antar agent. Harga ada di `PRICES` di dalam script.
- Kolom `*` artinya transcript subagent tidak ditemukan. Angkanya diambil dari ringkasan hasil Agent, tanpa analisis gap.
