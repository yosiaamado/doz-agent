# doz-agent

Kumpulan subagent + skill Claude Code pribadi. Upload sekali ke GitHub, lalu install ke project mana pun dengan 2 command.

## Isi

**Subagent** (`plugins/agents/`)

| Agent | Role | Bisa edit file? |
|---|---|---|
| `qa-tester` | Menulis & menjalankan test, mencari edge case, melaporkan bug | ✅ |
| `security-tester` | Audit kerentanan (injection, auth, IDOR, secret, dll.) | ❌ read-only |
| `code-reviewer` | Review kode sebelum commit/merge | ❌ read-only |
| `backend-engineer` | API, service, DB, migration, queue | ✅ |
| `frontend-engineer` | UI, komponen, state, form, a11y | ✅ |
| `devops-engineer` | Docker, CI/CD, deploy, infra, monitoring | ✅ |

**Skill** (`plugins/skills/`)

| Skill | Isi |
|---|---|
| `backend-patterns` | Aturan dasar backend + aturan per bahasa di `references/` (.NET, dll.) |
| `frontend-patterns` | Aturan coding & arsitektur frontend |
| `devops-patterns` | Best practice Docker, CI/CD, deploy, infra |
| `analytical-thinking` | Memecah masalah, root cause, membandingkan opsi |
| `business-thinking` | Validasi ide, prioritas fitur, unit economics, KPI |

## Struktur

```
doz-agent/
├── .claude-plugin/marketplace.json
└── plugins/
    ├── .claude-plugin/plugin.json
    ├── agents/        # 6 subagent
    └── skills/        # 5 skill (masing-masing <nama>/SKILL.md)
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

`backend-engineer`, `frontend-engineer`, dan `devops-engineer` otomatis membawa skill pattern masing-masing.

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
