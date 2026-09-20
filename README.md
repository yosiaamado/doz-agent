# doz-agent

Kumpulan subagent + skill Claude Code pribadi. Upload sekali ke GitHub, lalu install ke project mana pun dengan 2 command.

## Isi

**Subagent** (`plugins/agents/`)

| Agent | Role | Bisa edit file? |
|---|---|---|
| `product-owner` | Analisis dampak fitur, scope, user story INVEST + acceptance criteria, rencana agent yang dibutuhkan, dan accept/reject hasil | ❌ read-only |
| `system-analyst` | Kontrak API, model data, peta file BE/FE di satu file spec (`docs/specs/<slug>.md`). **Opsional** — hanya untuk desain besar (≥3 endpoint, migration, domain rumit) | 📝 hanya file spec |
| `qa-tester` | Strategi test berbasis risiko, teknik desain test (BVA, decision table), laporan bug severity + priority | ✅ |
| `security-tester` | Threat model STRIDE + audit OWASP Top 10:2025 / ASVS 5.0 | ❌ read-only |
| `code-reviewer` | Review ala Google eng practices, komentar berlabel blocking/non-blocking | ❌ read-only |
| `backend-engineer` | API, service, DB, migration, queue: requirement → desain → kode + test → verifikasi | ✅ |
| `frontend-engineer` | UI, komponen, state, form, WCAG 2.2 AA, Core Web Vitals | ✅ |
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

## Hemat token

- Model: `security-tester` pakai Opus; agent lain pakai Sonnet.
- Setiap agent punya bagian **Hemat token**: mulai dari file spec/brief (tidak menjelajahi ulang), BE dan FE tidak saling membaca kode, scope verifikasi = diff, test terkait saja selama iterasi, output test disaring, dan laporan padat.
- Skill pattern hanya di-preload ke engineer yang memakainya; skill lain dimuat lewat tool `Skill` saat dibutuhkan.
- `ship-feature` tidak memanggil agent untuk perubahan kecil, `system-analyst` hanya untuk desain besar, dan `security-tester` hanya jalan kalau perubahan menyentuh area sensitif.

**Kebiasaan di sisi user yang paling berpengaruh:**

1. **Satu fitur, satu session.** Seluruh isi chat dikirim ulang tiap giliran, jadi session panjang membuat setiap langkah makin mahal. Kalau terpaksa panjang, jalankan `/compact`.
2. **`CLAUDE.md` di tiap folder kerja** (BE dan FE terpisah). Jalankan `/init` sekali di masing-masing; setelah itu semua agent berhenti menebak stack dan perintah build/test.
3. **Pecah fitur besar jadi potongan vertikal** yang tetap bernilai. Dua alur ringan lebih murah daripada satu rantai penuh yang panjang.
4. **Lewati product-owner kalau requirement sudah jelas di kepalamu.** PO berguna saat masih kabur, bukan formalitas.
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

- Agent: buat `plugins/agents/<nama>.md` (frontmatter: `name`, `description`, `tools`, `model`)
- Skill: buat `plugins/skills/<nama>/SKILL.md` (frontmatter: `name`, `description`)
- Aturan backend untuk bahasa baru (misalnya Go, Node): buat `plugins/skills/backend-patterns/references/<bahasa>.md`, lalu tambahkan barisnya di tabel "Aturan per bahasa" di `backend-patterns/SKILL.md`
- Naikkan `version` di `plugin.json`, lalu push.

Tips: `description` menentukan kapan agent/skill dipakai otomatis. Tulis secara spesifik **kapan** harus dipakai, bukan cuma namanya.
