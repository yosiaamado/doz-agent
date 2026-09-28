# Workflows

Satu file `.md` = satu workflow. File ini adalah **sumber kebenaran**:
- **doz studio** (`studio/`) menggambar dan mengedit file ini sebagai kotak dan garis, lalu bisa menjalankannya.
- Skill **`run-workflow`** menjalankannya langsung dari Claude Code, tanpa studio: `/doz-agent:run-workflow <nama> <permintaan>`.

File agent (`plugins/agents/`) tidak menyimpan alur. Agent itu kotaknya, workflow itu garisnya, jadi satu agent bisa dipakai di banyak workflow.

## Format

```markdown
---
name: fitur-kecil
description: Satu kalimat
defaults: { runner: claude-cli, inputs: previous }   # berlaku ke semua node agent/skill
budget_usd: 8          # opsional: run berhenti kalau biaya lewat
parallel: 3            # opsional: node paralel maksimal
nodes:
  - { id: start, type: start, label: Permintaan }
  - { id: be, type: agent, agent: backend-engineer, label: Implementasi }
  - { id: qa, type: agent, agent: qa-tester, verdict: true }
  - { id: lolos, type: condition, source: qa, check: QA lolos? }
  - { id: selesai, type: output }
edges:
  - { from: start, to: be }
  - { from: be, to: qa }
  - { from: qa, to: lolos }
  - { from: lolos, to: selesai, when: true }
  - { from: lolos, to: be, when: false, loop: 2 }
layout:                # posisi kotak, hanya dipakai studio
  start: [ 0, 120 ]
---

Catatan bebas. Ikut dikirim ke setiap agent sebagai konteks workflow.
```

### Tipe node

| type | Field | Perilaku |
|---|---|---|
| `start` | `input` (opsional, default permintaan) | Titik awal. Output = permintaan saat run |
| `agent` | `agent` (wajib), `instructions`, `verdict` + pengaturan | Menjalankan subagent `plugins/agents/<agent>.md` |
| `skill` | `skill` (mis. `doz-agent:ship-feature`) + pengaturan | Menjalankan skill. Di studio hanya runner `claude-cli` |
| `condition` | `source`, `check`, `mode` (`auto`/`verdict`/`llm`), `model` | Memilih cabang. Pertama cek baris `VERDICT: PASS/FAIL` di output `source`; kalau tidak ada, penilai LLM (bawaan haiku) menjawab `check` |
| `approval` | `message` | Berhenti sampai manusia menyetujui (`when: true`) atau menolak (`when: false`) |
| `info` | `text` | Kotak informasi. Kalau disambung ke node, teksnya masuk ke konteks node itu |
| `output` | - | Mengumpulkan output semua agent/skill sebelumnya jadi laporan akhir |

`label` bisa diisi di semua node. `verdict: true` meminta agent menutup jawabannya dengan `VERDICT: PASS/FAIL`, supaya condition tidak perlu memanggil LLM lagi.

### Edge

- `{ from, to }`: output `from` mengalir ke `to`.
- Keluar dari `condition`/`approval` wajib punya `when: true|false`.
- `loop: N` menandai garis balik: node tujuan dan semua turunannya diulang dengan umpan balik, maksimal N kali. Siklus tanpa `loop` ditolak.

### Pengaturan (di `defaults` atau di node agent/skill)

Urutan prioritas: **node > defaults workflow > frontmatter agent > bawaan**. Nilai kosong atau `inherit` tidak ditulis ke file.

| Kunci | Nilai | Bawaan | Keterangan |
|---|---|---|---|
| `runner` | `claude-cli` / `api` | `claude-cli` | `claude-cli`: `claude -p` dengan login Claude Code. `api`: Claude API dengan `ANTHROPIC_API_KEY` dan tool lokal (read/glob/grep/edit/write/bash/load_skill) |
| `model` | `opus`/`sonnet`/`haiku`/id model | dari agent | |
| `effort` | `low`…`max` | dari agent | |
| `permission` | `read-only` | sesuai tools agent | Membuang Edit/Write. Di CLI, Bash dibatasi ke `git diff/log/status/show` dan `ls`. Di API, bash dibuang |
| `inputs` | `previous`/`all`/`none` | `previous` | Output node mana yang ikut ke prompt. Makin sedikit, makin hemat token |
| `max_output_chars` | angka | 12000 | Output node sebelumnya dipotong di sini |
| `max_turns` | angka | dari agent | |
| `timeout_min` | angka | 30 | |
| `retry` | angka | 0 | Ulang kalau gagal (error/timeout) |
| `budget_usd` | angka | - | Batas biaya per node |

Di `run-workflow` (Claude Code tanpa studio) yang berlaku hanya `model`, `permission` (sebagai instruksi), `inputs`, `max_output_chars`, dan `retry`. Sisanya hanya berlaku di studio.

## Progres realtime

Studio dan `run-workflow` sama-sama menulis event ke `<project>/.doz-studio/runs/<id>.jsonl` (satu JSON per baris: `run_start`, `node`, `activity`, `loop`, `cost`, `run_end`). Studio membaca folder ini, jadi run dari terminal Claude Code juga tampil di canvas. Tambahkan `.doz-studio/` ke `.gitignore` project.
