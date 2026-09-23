---
name: token-audit
description: Audit pemakaian token satu workflow Claude Code dari transcript session — token dan perkiraan biaya per agent, gap terbesar (file besar dibaca utuh, output command panjang, eksplorasi panjang, cache miss, narasi, laporan panjang, putaran perbaikan), dan saran perbaikan per file agent. Dipanggil otomatis di akhir ship-feature. Pakai juga saat user bilang "token audit", "berapa token yang kepake", "kenapa boros", "agent mana yang paling mahal", atau memanggil /token-audit.
argument-hint: "[--workflow NAMA | --all | --since ISO-TIME | --transcript PATH]"
---

# Token Audit

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

## Aturan

- **Tampilkan output script apa adanya.** Jangan diringkas ulang, jangan dihitung ulang, jangan menambah tabel sendiri. Angka token berasal dari `usage` API di transcript (persis). Ukuran hasil tool dan dampak $ adalah perkiraan.
- Setelah output, tambahkan **maksimal 2 kalimat** hanya kalau ada hal yang tidak terlihat dari angka. Contoh: gap disebabkan permintaan user yang memang besar, bukan karena agent-nya boros.
- **Jangan mengubah file agent otomatis.** Tawarkan ke user untuk menerapkan saran yang paling berdampak.
- Script gagal atau transcript tidak ditemukan → laporkan pesan error-nya dalam satu baris, lalu lanjutkan. Audit tidak boleh memblokir workflow.

## Cara membaca hasil

- **% biaya per agent** menunjukkan agent mana yang paling layak dioptimasi.
- **Gap** diurutkan dari perkiraan dampaknya. Konten yang masuk konteks lebih awal dibaca ulang dari cache di setiap turn berikutnya, jadi satu file besar di awal bisa lebih mahal daripada banyak file kecil di akhir.
- **Tren** muncul setelah ada minimal 2 run sebelumnya. Log disimpan di `~/.claude/doz-agent/token-audit.csv`.
- Harga $ adalah harga list API. Langganan Pro/Max tidak ditagih per token, jadi angka $ hanya pembanding antar agent. Harga ada di `PRICES` di dalam script.
- Kolom `*` artinya transcript subagent tidak ditemukan. Angkanya diambil dari ringkasan hasil Agent, tanpa analisis gap.
