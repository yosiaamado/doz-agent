---
name: run-workflow
description: Menjalankan workflow doz-agent yang tersimpan sebagai file (plugins/workflows/<nama>.md, dibuat di doz studio atau ditulis manual) langkah demi langkah dengan subagent, termasuk cabang condition, loop perbaikan, dan approval. Progres ditulis ke .doz-studio/runs/ supaya bisa dipantau realtime di doz studio. Pakai saat user memanggil /run-workflow, atau bilang "jalankan workflow <nama>". Jangan dipakai untuk fitur tanpa workflow tersimpan (itu ship-feature).
argument-hint: "<nama-workflow> <permintaan>"
---

# Run Workflow

Kamu (thread utama) menjalankan graph workflow persis seperti yang digambar. Jangan menambah atau melewati langkah.

**Argumen:** $ARGUMENTS

Kata pertama = nama workflow, sisanya = permintaan. Tanpa nama → tampilkan daftar workflow yang ada (kecuali `README.md`) lalu tanyakan. Permintaan kosong → pakai `input` di node start, kalau ada.

## 1. Temukan dan baca file

Cari `<nama>.md` berurutan di: `.claude/workflows/`, `plugins/workflows/` (keduanya di project), lalu `../../../workflows/` relatif terhadap base directory skill ini. Baca sekali.

Frontmatter berisi `nodes`, `edges`, `defaults`, `budget_usd`. Body di bawah frontmatter adalah **catatan workflow** yang ikut ke setiap prompt agent. Spesifikasi lengkap: `README.md` di folder workflows yang sama. Kalau ada edge ke node yang tidak ada, atau keluar dari condition/approval tanpa `when`, berhenti dan laporkan.

## 2. Log progres (untuk doz studio)

Buat id run `<YYYYMMDD-HHMMSS>-cc`. Setiap event ditulis sebagai **satu baris JSON** ke `.doz-studio/runs/<id>.jsonl` di root project dengan Bash (`mkdir -p .doz-studio/runs` sekali di awal). Contoh:

```bash
echo '{"type":"node","run":"<id>","node":"be","status":"running","activity":"Implementasi endpoint export"}' >> .doz-studio/runs/<id>.jsonl
```

| Kapan | Baris |
|---|---|
| Mulai | `{"type":"run_start","run":"<id>","workflow":"<nama>","source":"claude-code","input":"<permintaan ringkas>"}` |
| Node mulai | `{"type":"node","run":"<id>","node":"<nodeId>","status":"running","activity":"<apa yang dikerjakan>"}` |
| Node selesai | `{"type":"node","run":"<id>","node":"<nodeId>","status":"done","summary":"<1 kalimat>","verdict":true/false (kalau ada)}` |
| Node dilewati / gagal / menunggu | `status` `skipped` / `failed` (+ `"error"`) / `waiting` |
| Loop | `{"type":"loop","run":"<id>","edge":"<from>-><to>","count":<n>,"max":<maks>}` |
| Selesai | `{"type":"run_end","run":"<id>","status":"done"}` atau `"failed"` + `"error"` |

Tulis event untuk **setiap** node, termasuk start, info, dan node yang dilewati, supaya semua kotak di studio punya status. Teks di dalam JSON: satu baris, tanpa tanda kutip tunggal, maksimal ~150 karakter. Beberapa event boleh digabung dalam satu perintah Bash. Jangan menulis output lengkap agent ke log.

## 3. Aturan eksekusi

- **Urutan.** Node siap kalau semua sumber edge masuknya (kecuali edge `loop`) sudah selesai atau dilewati. Kalau tidak ada edge masuk yang aktif, node **dilewati**. Node yang siap bersamaan (misalnya dua agent setelah start) dipanggil **paralel dalam satu pesan**, maksimal `parallel` (bawaan 3).
- **start**: output = permintaan. **info**: teksnya jadi konteks untuk node yang disambungnya.
- **agent**: panggil tool `Agent` dengan `subagent_type: doz-agent:<agent>`. Prompt disusun dengan bagian berikut, sesuai urutannya:
  1. `# Workflow: <nama>` + catatan workflow
  2. `## Permintaan`
  3. `## Konteks tambahan` (node info yang tersambung)
  4. `## Hasil langkah sebelumnya`. Isinya ditentukan `inputs`: `previous` (bawaan) = node yang tersambung langsung, `all` = semua node sebelumnya, `none` = kosong. Tiap output dipotong ke `max_output_chars` (bawaan 12000).
  5. `## Umpan balik (percobaan ke-n)` kalau node ini diulang lewat loop
  6. `## Tugasmu di langkah ini` = `instructions`, atau "Kerjakan sesuai peranmu".
  7. `verdict: true` → tambahkan: "Akhiri jawabanmu dengan satu baris terpisah persis `VERDICT: PASS` atau `VERDICT: FAIL`."
- **Pengaturan node** (node menang atas `defaults`): `model` → parameter `model` di tool `Agent`. `permission: read-only` → tambahkan "Jangan mengubah file apa pun" ke prompt. `retry` → panggil ulang sekali lagi kalau agent gagal atau tidak mengembalikan laporan. `runner`, `effort`, `max_turns`, `timeout_min`, `budget_usd` hanya berlaku di doz studio; di sini diabaikan.
- **skill**: jalankan lewat tool `Skill` dengan prompt yang sama.
- **condition**: ambil baris `VERDICT:` terakhir dari output node `source` (bawaan: node yang masuk). Ada → pakai. Tidak ada → nilai sendiri pertanyaan `check` dari output itu, jangan memanggil agent. Hasil ya → ikuti edge `when: true`, tidak → `when: false`.
- **loop**: edge dengan `loop: N` mengulang node tujuan dan semua node di bawahnya, dengan output node sumber sebagai umpan balik. Sudah N kali dan masih gagal → `run_end` failed, laporkan ke user.
- **approval**: tulis status `waiting`, tampilkan ringkasan hasil sebelumnya + `message`, lalu tanya user dengan `AskUserQuestion` (Setujui / Tolak). Setuju → `when: true`, tolak → `when: false`, dan alasan penolakan ikut ke langkah berikutnya.
- **output**: gabungkan hasil node agent/skill sebelumnya jadi laporan akhir.

## 4. Hemat token

- Jangan membaca ulang file workflow atau agent. Jangan menempel output agent utuh ke user.
- Update ke user maksimal 1 baris per node selesai. Laporan lengkap hanya sekali di akhir: status, ringkasan per node, jumlah loop, dan hal yang butuh keputusan user.
