---
name: devops-patterns
description: Aturan dan best practice DevOps/SRE profesional. Mencakup Docker, CI/CD GitHub Actions, supply chain security (SHA pinning, SBOM, scanning), deployment & rollback, config/secret, Nginx, Kubernetes, Terraform/IaC, observability, SLO & error budget, incident response, dan backup/DR. Pakai saat membuat atau mengubah Dockerfile, pipeline CI/CD, konfigurasi deploy, infrastruktur, monitoring, atau saat debugging build/deploy.
---

# DevOps Patterns

Isinya **keputusan default** untuk hal yang belum diatur project, bukan tutorial. Setup yang sudah ada di project **selalu menang**. Jangan menambahkan tool atau pola dari sini ke project yang belum memakainya, kecuali diminta.

## 0. Keselamatan

- Perintah yang menyentuh environment bersama/production atau bersifat destruktif (`terraform apply/destroy`, `kubectl apply/delete` ke remote, deploy, drop DB, `prune`, perubahan IAM/DNS/firewall) **hanya dijalankan setelah user konfirmasi.** Jalankan `plan`, `diff`, atau `--dry-run` dulu dan jelaskan dampaknya.
- Secret tidak pernah masuk git, image, log, atau output CI.
- Semua perubahan infrastruktur lewat kode (IaC) yang di-review, bukan klik manual di console.

## 1. Artefak

Build once, deploy many: satu image bertag git SHA dipromosikan dev → staging → prod. Yang berbeda hanya config (env). Least privilege untuk token CI, IAM role, container, dan akses DB.

## 2. Docker

- Base image dipin (production: sampai digest `@sha256:...`), minimal (alpine/distroless/chiseled), tidak pernah `latest`, dan diperbarui lewat Dependabot/Renovate.
- Multi-stage build, user non-root, `.dockerignore` (`.git`, `node_modules`, `bin/`, `obj/`, `.env*`, output test), layer diurutkan dari yang jarang berubah ke yang sering berubah.
- Satu proses per container, log ke stdout/stderr, SIGTERM ditangani, `HEALTHCHECK` ke `/health/live`.
- Tidak ada secret di `ARG`/`ENV`/layer image; build yang butuh secret memakai BuildKit `--mount=type=secret`.
- Image di-scan (Trivy/Grype) di CI; build gagal kalau ada Critical/High yang sudah ada perbaikannya.

## 3. docker-compose (dev lokal)

Service DB/cache memakai volume bernama dan `healthcheck`, dengan `depends_on: condition: service_healthy`. Env dari `.env` (masuk `.gitignore`), plus `.env.example` lengkap tanpa nilai rahasia. Satu command (`docker compose up`) yang tertulis di README.

## 4. CI/CD (GitHub Actions)

```
PR:   install (cache) → lint/format → type-check → unit test → build → integration test → scan (SAST, dependency, secret, image)
main: semua di atas → build & push image (tag SHA) → deploy staging → smoke test → approval → deploy prod → verifikasi
```

- Target PR < 10 menit: cache dependency dan job paralel. Branch protection di `main` (wajib PR, review, CI hijau).
- `permissions:` minimal di level workflow (`contents: read`), dinaikkan per job hanya kalau perlu.
- Action pihak ketiga dipin ke **full commit SHA** dengan komentar versi (`uses: actions/checkout@<sha> # v4.2.2`), di-update lewat Dependabot.
- Auth ke cloud pakai OIDC (`id-token: write`), bukan access key statis. Secret per GitHub Environment, dengan required reviewer untuk production.
- **Jangan pakai `pull_request_target`** yang men-checkout kode PR: secret bisa bocor ke PR dari fork. Pakai `concurrency` supaya deploy ke environment yang sama tidak bertabrakan.
- Lockfile di-commit dan install mode frozen (`npm ci`, `dotnet restore --locked-mode`). Artefak rilis punya SBOM (Syft/CycloneDX) dan attestation (`actions/attest-build-provenance`). Secret scanning + push protection aktif.

## 5. Deploy & rilis

- Rolling update dengan readiness probe; canary atau blue-green untuk perubahan berisiko. Feature flag memisahkan deploy dari rilis ke user.
- Migration DB dijalankan sebagai langkah terkontrol sebelum deploy, dan backward-compatible dengan versi aplikasi yang sedang berjalan (expand → contract).
- Rollback = deploy ulang image SHA sebelumnya; langkahnya terdokumentasi dan pernah diuji.
- Setelah deploy: smoke test otomatis, lalu pantau error rate dan latency ±15–30 menit; rollback kalau melewati ambang batas. Graceful shutdown: berhenti menerima request, selesaikan yang sedang berjalan.

## 6. Config & secret

Config lewat env, divalidasi saat startup (gagal cepat kalau ada yang hilang). Secret di secret manager atau CI environment secret, dan dirotasi berkala. Dev, staging, dan prod terpisah total (credential, database, akses). Secret bocor ke git → **rotasi dulu**, baru bersihkan history.

## 7. Nginx / reverse proxy

HTTPS (TLS 1.2+, sertifikat otomatis, HTTP di-redirect) · header `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Content-Security-Policy`/`frame-ancestors` · `client_max_body_size`, timeout, `limit_req`, gzip/brotli, dan cache panjang untuk aset yang namanya ber-hash · `X-Forwarded-For`/`X-Forwarded-Proto` diteruskan, dan aplikasi hanya memercayai proxy yang dikenal · `nginx -t` sebelum reload.

## 8. Kubernetes

`resources.requests`/`limits`, `readinessProbe`, `livenessProbe` (plus `startupProbe` untuk aplikasi yang lambat start) · `securityContext`: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, drop semua capability · config lewat ConfigMap, secret lewat External Secrets/Sealed Secrets (bukan Secret mentah di git) · service penting: minimal 2 replika, PodDisruptionBudget, HPA untuk beban naik-turun, NetworkPolicy default-deny · Helm/Kustomize, idealnya GitOps (Argo CD/Flux); `kubectl diff` sebelum apply.

## 9. Terraform / IaC

State di remote backend dengan locking dan enkripsi, tidak pernah di-commit · versi Terraform dan provider dipin, `.terraform.lock.hcl` di-commit · modul yang bisa dipakai ulang, folder/workspace per environment, tanpa nilai hardcode · alur: `fmt -check` → `validate` → `tflint`/`checkov` → `plan` (di-review di PR) → `apply` dari CI setelah approve · semua resource diberi tag (`env`, `service`, `owner`, `cost-center`) · `plan` terjadwal untuk mendeteksi drift.

## 10. Observability, alert & insiden

- Log terstruktur, metric, dan trace lewat OpenTelemetry; log & trace terpusat dengan retensi jelas dan PII di-mask. Metric RED per service, USE per resource. Dashboard per service dan uptime check eksternal ke endpoint health.
- Alert berdasarkan gejala yang dirasakan user dan burn rate SLO, bukan setiap CPU spike. Setiap alert bisa ditindaklanjuti dan punya runbook; alert yang sering berbunyi tanpa tindakan dihapus atau diperbaiki. Error budget habis → prioritaskan reliability dibanding fitur baru.
- Insiden: pulihkan dulu (rollback, matikan feature flag, scale), baru investigasi. Postmortem blameless untuk SEV1–SEV2; detailnya di skill `engineering-workflow`.

## 11. Backup, DR & biaya

- Setiap sistem punya RPO dan RTO. Backup otomatis, terenkripsi, di lokasi/akun lain (3-2-1) dengan retensi jelas, plus point-in-time recovery untuk DB penting. **Restore diuji berkala**; backup yang tidak pernah diuji restore dianggap tidak ada.
- Right-size resource dari metric pemakaian nyata, non-production di-scale down di luar jam kerja, dan budget alert dipasang di akun cloud.
