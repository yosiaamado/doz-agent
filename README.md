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

**Skill** (`plugins/skills/<bidang>/<nama>/SKILL.md`)

Skill dikelompokkan per bidang. Nama folder bidang tidak memengaruhi cara pemanggilan: skill tetap dipanggil `doz-agent:<nama>`.

| Skill | Bidang | Isi |
|---|---|---|
| `ship-feature` | engineering | **Titik masuk utama.** Orkestrator satu perintah: ukur pekerjaan (kecil/sedang/besar), jalankan hanya agent yang dibutuhkan (PO → SA → BE ∥ FE → verifikasi paralel → acceptance), loop perbaikan, berhenti hanya untuk keputusan bisnis |
| `token-audit` | engineering | Audit token & kegagalan satu workflow dari transcript: token & perkiraan biaya per agent, gap terbesar (file besar dibaca utuh, output panjang, eksplorasi, cache miss, narasi, laporan panjang), kegagalan agent & temuan blocking per kategori, pola kegagalan berulang lintas workflow, dan saran per file agent. Otomatis di akhir `ship-feature`; manual: `/doz-agent:token-audit [--all]` |
| `product-ownership` | product | Kerangka kerja PO (Scrum Guide 2020): analisis dampak, INVEST, Given/When/Then, story splitting, DoR, penentuan agent, penerimaan hasil |
| `engineering-workflow` | engineering | Alur kerja tim: DoR/DoD, branching, Conventional Commits, PR, code review, ADR, SemVer, incident & postmortem |
| `backend-patterns` | engineering | Aturan dasar backend (REST, RFC 9457, migration zero-downtime, OWASP, resiliency, OpenTelemetry) + aturan per bahasa di `references/` (.NET, dll.) |
| `frontend-patterns` | engineering | Struktur, state, form, WCAG 2.2 AA, Core Web Vitals, CSP, testing trophy |
| `devops-patterns` | engineering | Docker, CI/CD + supply chain, deploy & rollback, K8s, Terraform, SLO, DR, metrik DORA |
| `analytical-thinking` | thinking | MECE, hipotesis, root cause, estimasi Fermi, matriks keputusan, pre-mortem |
| `business-thinking` | product | Validasi ide, PRD, RICE/WSJF, unit economics, pricing, OKR, A/B test, build vs buy, UU PDP |
| `rab-kontraktor-advisor` | consultant | Konteks produk RAB generator untuk kontraktor kecil: standar AHSP/HSPK/SNI, BOQ/AACE, pola data & UX software estimasi |

## Struktur

```
doz-agent/
├── .claude-plugin/marketplace.json
└── plugins/
    ├── .claude-plugin/plugin.json
    ├── agents/                  # 8 subagent (file datar, tanpa subfolder)
    └── skills/
        ├── engineering/         # backend/frontend/devops-patterns, engineering-workflow, ship-feature, token-audit
        ├── product/             # product-ownership, business-thinking
        ├── thinking/            # analytical-thinking
        └── consultant/          # rab-kontraktor-advisor (skill domain per produk/klien)
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

**Kapan dibaca:** `MEMORY.md` dimuat otomatis oleh Claude Code di awal setiap panggilan (makanya dibatasi 60 baris). File detail modul dibaca paling awal, sebelum eksplorasi apa pun. Agent memverifikasi satu anchor (grep satu nama simbol dari catatan); kalau tidak cocok, catatannya diabaikan, dicari ulang, lalu diperbarui. **Kode selalu menang atas memory.**

Isinya nama simbol + path + jebakan, **bukan nomor baris** (paling cepat basi) dan bukan potongan kode. Tiap catatan menyimpan commit SHA, jadi basi bisa dicek dengan `git log --oneline <sha>..HEAD -- <path>`.

Fitur pertama di satu area belum ada hematnya — untungnya mulai terasa dari sentuhan kedua.

**Belajar dari review:** saat dipanggil di loop perbaikan, engineer menyimpan **pola** temuan reviewer/QA (bukan hanya fix-nya) — yang spesifik modul ke `Jebakan`, yang umum ke bagian `Pelajaran review` di `MEMORY.md` (maks 10 baris). Kesalahan yang sama tidak terulang di fitur berikutnya.

## Mengukur token

Setiap `ship-feature` ditutup dengan **token audit**. Script `token-audit` membaca transcript Claude Code (`~/.claude/projects/...`), lalu menampilkan:

- **Token per agent** dari angka `usage` API (persis) dan perkiraan biayanya (harga list API, hanya sebagai pembanding).
- **Gap terbesar, diurutkan dari dampaknya.** Konten yang masuk konteks dibaca ulang dari cache di setiap turn berikutnya, jadi file besar di awal ikut dihitung sampai akhir.
- **Saran perbaikan** yang menunjuk ke file agent yang perlu diubah.
- **Kegagalan & temuan**, dibaca dari format laporan agent: status engineer (`blocked`, atau tanpa status sama sekali), keputusan reviewer/QA/security, temuan blocking per engineer dan kategori (test lama, null/no-op, loop/data korup, authorization, dst.), test/build yang gagal di dalam agent, laporan yang dikembalikan orkestrator, dan temuan yang muncul lagi setelah diperbaiki.
- **Pola kegagalan berulang**: kategori blocking yang sama untuk engineer yang sama di ≥2 dari 5 workflow terakhir, dicatat lintas project. Saran dari pola ini ditampilkan paling atas, karena mengurangi putaran perbaikan biasanya lebih hemat daripada memangkas token.
- **Bukti singkat**: setiap kegagalan disertai satu baris penyebab dari data asli, misalnya error kompilasi, nama test yang gagal, atau temuan aslinya beserta nama project.
- **Saran selalu umum**: yang diperbaiki adalah aturan kerja agent di plugin ini, bukan error project tertentu, supaya agent tetap berlaku untuk project lain. Kegagalan karena lingkungan (DB mati, perintah tidak ada) diarahkan ke `CLAUDE.md` project.
- **Tren** dibanding run sebelumnya. Log disimpan di `~/.claude/doz-agent/token-audit.csv` (token) dan `findings.csv` (temuan).

Pakai ini sebelum mengubah prompt agent. Perbaiki gap yang terbesar dulu, lalu bandingkan tren di run berikutnya.

## Format laporan agent

Laporan agent masuk utuh ke konteks thread utama dan ikut terkirim ulang di tiap giliran, jadi formatnya dibuat seperti data, bukan prosa:

- **Baris pertama = status/keputusan**: engineer `Status: done | blocked | needs-decision | too-big`, reviewer `Keputusan:`, QA dan security `Rekomendasi:`. Orkestrator menentukan langkah berikutnya tanpa membaca seluruh laporan.
- **Satu temuan = satu baris** dengan ID (`CR-1`, `QA-BUG-1`, `SEC-1`) dan `path:line`. Baris itu disalin apa adanya ke batch perbaikan, dan engineer membalas per ID.
- **Tanpa narasi di antara tool call.** Laporan ke orkestrator ringkas; spec, memory, test, commit, dan peringatan security tetap kalimat lengkap.

## Mengurangi putaran review

Engineer wajib **self-review** diff-nya sendiri sebelum melapor: test lama yang terdampak, tiap AC ditelusuri ke kode (termasuk varian "mengosongkan" seperti set ke `null` — tidak boleh ada jalur yang diam-diam no-op), loop atas data lama yang bisa korup, security dasar, dan kesesuaian kontrak. Laporannya menyertakan **Peta AC → test**, yang diteruskan ke QA supaya QA menguji celah, bukan mengulang test yang sudah ada.

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
5. **Engineer dilanjutkan, bukan dipanggil ulang.** Setelah `needs-decision`, `blocked`, laporan partial, laporan dikembalikan, atau temuan yang butuh pemahaman desain, `ship-feature` melanjutkan engineer yang sama lewat `SendMessage`, jadi hasil eksplorasinya tidak dibuang. Verifikasi ulang tetap panggilan baru dengan scope sempit.
6. **Skill dimuat kondisional.** `references/dotnet.md` cuma kalau menulis C#; `references/runtime.md` cuma kalau menyentuh cache/queue/observability; agent verifikasi memuat skill pattern cuma kalau diff menyentuh stack itu.
7. **Laporan dibatasi** (engineer, QA, devops 250 kata).
8. **Cache 1 jam hanya di agent yang menjalankan build/test panjang** (engineer, QA, devops). Cache write 1 jam ditagih 2× harga input (5 menit: 1,25×), dan baru balik modal kalau ada jeda 5–60 menit antar-request, misalnya engineer yang dilanjutkan setelah verifikasi. Agent lain (PO, system-analyst, reviewer, security) memakai default 5 menit, karena di dalam satu run jarak antar-request cuma hitungan detik. `token-audit` menandai agent yang membayar TTL 1 jam tanpa jeda ≥5 menit.

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

**Agent** dipanggil otomatis kalau konteksnya cocok, kecuali agent verifikasi (`code-reviewer`, `qa-tester`, `security-tester`): mereka tidak dipanggil otomatis setelah kode berubah, supaya perubahan kecil tidak memicu verifikasi yang mahal. Panggil langsung, atau lewat `ship-feature`:

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

- Agent: buat `plugins/agents/<nama>.md` (frontmatter: `name`, `description`, `tools`, `model`, `effort`, `maxTurns`, `color`, opsional `skills`, `memory`, `experimental.cacheTtl` — isi `1h` hanya kalau agent-nya menjalankan build/test yang bisa lebih dari 5 menit)
- Skill: buat `plugins/skills/<bidang>/<nama>/SKILL.md` (frontmatter: `name`, `description`, opsional `effort`, `model`, `argument-hint`). Bidang baru cukup bikin folder baru; nama pemanggilan tetap `doz-agent:<nama>` karena diambil dari frontmatter `name`, bukan dari path
- Aturan backend untuk bahasa baru (misalnya Go, Node): buat `plugins/skills/engineering/backend-patterns/references/<bahasa>.md`, lalu tambahkan barisnya di tabel "Aturan per bahasa" di `backend-patterns/SKILL.md`
- Naikkan `version` di `plugin.json`, lalu push.

Tips: `description` menentukan kapan agent/skill dipakai otomatis. Tulis secara spesifik **kapan** harus dipakai, bukan cuma namanya.
