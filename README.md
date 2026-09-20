# doz-agent

Kumpulan subagent + skill Claude Code pribadi. Upload sekali ke GitHub, lalu install ke project mana pun dengan 2 command.

## Isi

**Subagent** (`plugins/agents/`)

| Agent | Role | Bisa edit file? |
|---|---|---|
| `product-owner` | **Sekali jalan:** analisis dampak, scope, user story INVEST + acceptance criteria, keputusan + default, rencana agent, dan accept/reject hasil | ❌ read-only |
| `system-analyst` | Kontrak API, model data, peta file BE/FE di satu file spec (`docs/specs/<slug>.md`). **Opsional** — hanya untuk desain besar (≥3 endpoint, migration, domain rumit) | 📝 hanya file spec |
| `qa-tester` | Strategi test berbasis risiko, teknik desain test (BVA, decision table), laporan bug severity + priority | ✅ |
| `security-tester` | Threat model STRIDE + audit OWASP Top 10:2025 / ASVS 5.0 | ❌ read-only |
| `code-reviewer` | Review ala Google eng practices, komentar berlabel blocking/non-blocking | ❌ read-only |
| `backend-engineer` | API, service, DB, migration, queue: requirement → desain → kode + test → verifikasi. 🧠 punya memory peta alur kode | ✅ |
| `frontend-engineer` | UI, komponen, state, form, WCAG 2.2 AA, Core Web Vitals. 🧠 punya memory peta komponen | ✅ |
| `devops-engineer` | Docker, CI/CD, deploy, IaC, observability, SLO, dengan aturan keselamatan production | ✅ |

**Skill** (`plugins/skills/`)

| Skill | Isi |
|---|---|
| `ship-feature` | **Titik masuk utama.** Orkestrator satu perintah: ukur pekerjaan (kecil/sedang/besar), jalankan hanya agent yang dibutuhkan (PO → SA → BE ∥ FE → verifikasi paralel → acceptance), loop perbaikan, berhenti hanya untuk keputusan bisnis |
| `product-ownership` | Kerangka kerja PO (Scrum Guide 2020): analisis dampak, INVEST, Given/When/Then, story splitting, DoR, penentuan agent, penerimaan hasil |
| `engineering-workflow` | Alur kerja tim: DoR/DoD, branching, Conventional Commits, PR, code review, ADR, SemVer, incident & postmortem |
| `backend-patterns` | Aturan dasar backend (REST, RFC 9457, migration zero-downtime, OWASP, resiliency, OpenTelemetry) + aturan per bahasa di `references/` (.NET, dll.) |
| `frontend-patterns` | Struktur, state, form, WCAG 2.2 AA, Core Web Vitals, CSP, testing trophy |
| `devops-patterns` | Docker, CI/CD + supply chain, deploy & rollback, K8s, Terraform, SLO, DR, metrik DORA |
| `analytical-thinking` | MECE, hipotesis, root cause, estimasi Fermi, matriks keputusan, pre-mortem |
| `business-thinking` | Validasi ide, PRD, RICE/WSJF, unit economics, pricing, OKR, A/B test, build vs buy, UU PDP |

## Struktur

```
doz-agent/
├── .claude-plugin/marketplace.json
└── plugins/
    ├── .claude-plugin/plugin.json
    ├── agents/        # 8 subagent
    └── skills/        # 8 skill (masing-masing <nama>/SKILL.md)
```

## Alur kerja fitur

Cukup satu perintah, atau tulis biasa "kerjain fitur X sampai selesai":

```
/doz-agent:ship-feature tambah fitur wishlist di catalog-web
```

| Ukuran | Alur |
|---|---|
| Kecil | Dikerjakan langsung tanpa agent |
| Sedang | Kontrak API (kalau FE + BE) → backend ∥ frontend → review ∥ QA |
| Besar | product-owner → kontrak API → backend ∥ frontend → review ∥ QA ∥ security → product-owner (acceptance) |

**Kontrak API** ditulis ke `docs/specs/<slug>.md` supaya BE dan FE tidak perlu saling membaca kode. Siapa yang menulisnya tergantung ukuran desain:

| Kondisi | Cara |
|---|---|
| 1–2 endpoint, pola API sudah jelas | Ditulis langsung oleh thread utama (paling hemat: tidak ada eksplorasi ulang) |
| ≥3 endpoint, migration, atau domain rumit | `system-analyst` |
| Bentuk response belum pasti, atau porsi FE kecil | Tanpa kontrak di depan: `backend-engineer` dulu, kontraknya diambil dari laporannya, baru `frontend-engineer` |

Mau diskusi dulu tanpa implementasi? Pakai `/doz-agent:product-ownership <ide>` (bolak-balik di chat utama), lalu lanjutkan dengan `ship-feature`.

## Memory: agent yang ingat alur kode

`backend-engineer` dan `frontend-engineer` pakai `memory: project`, jadi mereka menyimpan **peta alur kode per project** di `.claude/agent-memory/<agent>/` (ikut git, bisa di-review di PR).

```
.claude/agent-memory/backend-engineer/
├── MEMORY.md     # router tipis, maks 60 baris: konvensi repo + 1 baris per modul
└── orders.md     # detail per modul, maks 15 baris
```

**Kapan ditulis:** setelah build/test hijau, sebelum menulis laporan — jadi yang tersimpan sudah terbukti benar, bukan tebakan.

**Kapan dibaca:** paling awal, sebelum eksplorasi apa pun. Agent memverifikasi satu anchor (grep satu nama simbol dari catatan); kalau tidak cocok, catatannya diabaikan, dicari ulang, lalu diperbarui. **Kode selalu menang atas memory.**

Isinya nama simbol + path + jebakan, **bukan nomor baris** (paling cepat basi) dan bukan potongan kode. Tiap catatan menyimpan commit SHA, jadi basi bisa dicek dengan `git log --oneline <sha>..HEAD -- <path>`.

Fitur pertama di satu area belum ada hematnya — untungnya mulai terasa dari sentuhan kedua.

## Hemat token

**Model & effort:** peran yang menentukan kualitas seluruh rantai pakai Opus, peran eksekusi pakai Sonnet.

| Agent | Model | Effort | maxTurns |
|---|---|---|---|
| `product-owner` | opus | high | 15 |
| `system-analyst` | opus | high | 25 |
| `code-reviewer` | opus | high | 25 |
| `security-tester` | opus | high | 30 |
| `backend-engineer`, `frontend-engineer` | sonnet | medium | 50 |
| `qa-tester`, `devops-engineer` | sonnet | medium | 40 |

Alasannya: kontrak API yang salah bikin rework 2 agent — jauh lebih mahal dari selisih model. `maxTurns` mencegah agent menjelajah tanpa henti, dan tiap agent punya aturan **"buntu setelah ~15 pencarian → berhenti dan lapor"**.

**Yang paling menghemat, urut dari yang terbesar:**

1. **Peta file di brief.** Engineer cuma boleh menyentuh file yang disebut di situ (+ maks 3 file konteks). Ini yang memotong eksplorasi dari nol — biaya terbesar di seluruh alur.
2. **Memory peta kode** di BE/FE, buat area yang pernah disentuh.
3. **Tidak memanggil agent untuk hal yang bisa dikerjakan thread utama.** `ship-feature` menulis kontrak sendiri untuk 1–2 endpoint, dan mengerjakan perubahan Kecil tanpa agent sama sekali.
4. **PO sekali jalan.** Maksimal 3 pertanyaan, semuanya punya default, jadi tidak ada panggilan kedua.
5. **Skill dimuat kondisional.** `references/dotnet.md` cuma kalau menulis C#; `references/runtime.md` cuma kalau menyentuh cache/queue/observability; agent verifikasi memuat skill pattern cuma kalau diff menyentuh stack itu.
6. **Laporan dibatasi** (engineer 200 kata, QA/devops 250) dan `prompt-cache 1 jam` aktif di semua agent.

**Kebiasaan di sisi user yang paling berpengaruh:**

1. **Satu fitur, satu session.** Seluruh isi chat dikirim ulang tiap giliran, jadi session panjang membuat setiap langkah makin mahal. Kalau terpaksa panjang, jalankan `/compact`.
2. **`CLAUDE.md` di tiap folder kerja** (BE dan FE terpisah). Jalankan `/init` sekali di masing-masing.
3. **Pecah fitur besar jadi potongan vertikal** yang tetap bernilai.
4. **Lewati product-owner kalau requirement sudah jelas di kepalamu.**
5. **Jangan ulang rantai penuh untuk perbaikan kecil.** Cukup agent yang menemukan masalahnya yang mengecek ulang.

## Upload ke GitHub

```bash
git init
git add .
git commit -m "init doz-agent"
git branch -M main
git remote add origin https://github.com/<username>/doz-agent.git
git push -u origin main
```

## Install di project mana pun

Buka Claude Code di folder project, lalu jalankan:

```
/plugin marketplace add <username>/doz-agent
/plugin install doz-agent@doz-agent
```

Marketplace cukup ditambahkan sekali per mesin. Kalau repo-nya private, pastikan `git` di mesin itu sudah login ke GitHub.

## Cara pakai

**Skill** ke-load otomatis kalau topiknya cocok dengan `description`-nya. Bisa juga dipanggil manual:

```
/doz-agent:backend-patterns
/doz-agent:business-thinking
```

**Agent** dipanggil otomatis kalau konteksnya cocok, atau disebut langsung:

```
pakai agent qa-tester buat test fitur checkout
suruh security-tester audit folder src/auth
@agent-doz-agent:code-reviewer review perubahan gw
```

Semua agent engineer otomatis membawa skill pattern masing-masing. Setiap agent menutup laporannya dengan bagian **Handoff** yang menyarankan agent berikutnya (misalnya backend-engineer → qa-tester → security-tester → code-reviewer).

## Update

Edit file, lalu commit & push. Di mesin yang sudah install, jalankan:

```
/plugin marketplace update doz-agent
```

## Nambah agent / skill baru

- Agent: buat `plugins/agents/<nama>.md` (frontmatter: `name`, `description`, `tools`, `model`, `effort`, `maxTurns`, `color`, opsional `skills`, `memory`, `experimental.cacheTtl`)
- Skill: buat `plugins/skills/<nama>/SKILL.md` (frontmatter: `name`, `description`, opsional `effort`, `model`, `argument-hint`)
- Aturan backend untuk bahasa baru (misalnya Go, Node): buat `plugins/skills/backend-patterns/references/<bahasa>.md`, lalu tambahkan barisnya di tabel "Aturan per bahasa" di `backend-patterns/SKILL.md`
- Naikkan `version` di `plugin.json`, lalu push.

Tips: `description` menentukan kapan agent/skill dipakai otomatis. Tulis secara spesifik **kapan** harus dipakai, bukan cuma namanya.
