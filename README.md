# doz-agent

Kumpulan subagent + skill Claude Code pribadi. Upload sekali ke GitHub, lalu install ke project mana pun dengan 2 command.

## Isi

**Subagent** (`plugins/agents/`)

| Agent | Role | Bisa edit file? |
|---|---|---|
| `qa-tester` | Strategi test berbasis risiko, teknik desain test (BVA, decision table), laporan bug severity + priority | ✅ |
| `security-tester` | Threat model STRIDE + audit OWASP Top 10:2025 / ASVS 5.0 | ❌ read-only |
| `code-reviewer` | Review ala Google eng practices, komentar berlabel blocking/non-blocking | ❌ read-only |
| `backend-engineer` | API, service, DB, migration, queue: requirement → desain → kode + test → verifikasi | ✅ |
| `frontend-engineer` | UI, komponen, state, form, WCAG 2.2 AA, Core Web Vitals | ✅ |
| `devops-engineer` | Docker, CI/CD, deploy, IaC, observability, SLO, dengan aturan keselamatan production | ✅ |

**Skill** (`plugins/skills/`)

| Skill | Isi |
|---|---|
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
    ├── agents/        # 6 subagent
    └── skills/        # 6 skill (masing-masing <nama>/SKILL.md)
```

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

Semua agent engineer otomatis membawa skill pattern masing-masing + `engineering-workflow`. Setiap agent menutup laporannya dengan bagian **Handoff** yang menyarankan agent berikutnya (misalnya backend-engineer → qa-tester → security-tester → code-reviewer).

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
