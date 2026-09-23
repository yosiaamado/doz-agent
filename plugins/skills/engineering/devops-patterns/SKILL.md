---
name: devops-patterns
description: Aturan dan best practice DevOps/SRE profesional. Mencakup Docker, CI/CD GitHub Actions, supply chain security (SHA pinning, SBOM, scanning), deployment & rollback, config/secret, Nginx, Kubernetes, Terraform/IaC, observability, SLO & error budget, incident response, backup/DR, dan metrik DORA. Pakai saat membuat atau mengubah Dockerfile, pipeline CI/CD, konfigurasi deploy, infrastruktur, monitoring, atau saat debugging build/deploy.
---

# DevOps Patterns

Setup yang sudah ada di project **selalu menang**. Pakai aturan ini sebagai default.

## 0. Aturan keselamatan

- Perintah yang menyentuh environment bersama/production atau bersifat destruktif (`terraform apply/destroy`, `kubectl apply/delete` ke remote, deploy, drop DB, `prune`, perubahan IAM/DNS/firewall) **hanya dijalankan setelah user konfirmasi.** Jalankan `plan`, `diff`, atau `--dry-run` dulu dan jelaskan dampaknya.
- Secret tidak pernah masuk git, image, log, atau output CI.
- Semua perubahan infrastruktur lewat kode (IaC) yang di-review. Tidak ada perubahan manual di console.

## 1. Prinsip

- **Build once, deploy many:** satu artefak (image dengan tag git SHA) dipromosikan dev → staging → prod. Yang berbeda hanya config.
- **12-factor app:** config lewat env, proses stateless, log ke stdout, dan dev/prod dibuat semirip mungkin.
- **Least privilege** di setiap tempat: token CI, IAM role, container, dan akses DB.
- **Otomatisasi** semua yang dilakukan lebih dari dua kali.
- **Immutable infrastructure:** jangan patch server secara manual. Ganti dengan versi baru.

## 2. Docker

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health/live || exit 1
CMD ["node", "dist/main.js"]
```

- **Base image:**
  - Versi dipin (untuk production, lebih baik sampai digest `@sha256:...`), dan diperbarui rutin lewat Dependabot/Renovate.
  - Pakai image minimal (alpine, distroless, chiseled).
  - Jangan pakai `latest`.
- **Multi-stage build** dan user **non-root**.
- Sediakan `.dockerignore` (`.git`, `node_modules`, `bin/`, `obj/`, `.env*`, test output).
- Urutkan layer dari yang jarang berubah ke yang sering berubah, supaya cache efektif.
- Satu proses per container, log ke stdout/stderr, dan tangani SIGTERM.
- Tidak ada secret di `ARG`/`ENV`/layer image. Pakai BuildKit `--mount=type=secret` kalau build butuh secret.
- Image di-scan (Trivy/Grype) di CI, dan build gagal kalau ada vulnerability Critical/High yang sudah ada perbaikannya.

## 3. docker-compose (dev lokal)

- Service DB/cache pakai volume bernama dan `healthcheck`, dan `depends_on` memakai `condition: service_healthy`.
- Env diambil dari `.env` (masuk `.gitignore`). Sediakan `.env.example` yang lengkap tanpa nilai rahasia.
- Satu command untuk menjalankan semuanya (`docker compose up`), dan didokumentasikan di README.

## 4. CI/CD (GitHub Actions)

**Urutan pipeline:**

```
PR:   install (cache) → lint/format → type-check → unit test → build → integration test → scan (SAST, dependency, secret, image)
main: semua di atas → build & push image (tag SHA) → deploy staging → smoke test → approval → deploy prod → verifikasi
```

**Aturan:**
- **Branch protection** di `main`: wajib PR, review, dan CI hijau. Tidak boleh push langsung.
- **`permissions:`** minimal di level workflow (`contents: read`), lalu dinaikkan per job hanya kalau perlu.
- **Action pihak ketiga dipin ke full commit SHA**, dengan komentar versi: `uses: actions/checkout@<sha> # v4.2.2`. Update lewat Dependabot.
- **Auth ke cloud pakai OIDC** (`id-token: write`), bukan access key statis di secrets.
- **Secret per environment** (GitHub Environments), dengan required reviewer untuk production.
- **Jangan pakai `pull_request_target`** yang men-checkout kode PR, karena bisa membocorkan secret ke PR dari fork.
- Pakai `concurrency` supaya deploy ke environment yang sama tidak saling tabrak.
- Pipeline harus cepat (target < 10 menit untuk PR): cache dependency dan jalankan job secara paralel.
- **Supply chain:**
  - Lockfile di-commit dan install memakai mode frozen (`npm ci`, `dotnet restore --locked-mode`).
  - Generate SBOM (Syft/CycloneDX) dan attestation/provenance (`actions/attest-build-provenance`) untuk artefak rilis.
- **Secret scanning** (gitleaks / GitHub secret scanning + push protection) aktif.

## 5. Deployment & release

- **Strategi rollout:** rolling update dengan readiness probe untuk kasus umum, dan canary atau blue-green untuk perubahan berisiko. Traffic baru hanya dikirim ke instance yang lolos readiness.
- **Feature flag** untuk memisahkan *deploy* (kode sampai di production) dari *release* (fitur aktif untuk user).
- **Migration DB:**
  - Dijalankan sebagai langkah terkontrol sebelum deploy.
  - Harus backward-compatible dengan versi aplikasi yang sedang berjalan (pola expand → contract).
- **Rollback** cukup dengan deploy ulang image SHA sebelumnya. Langkahnya didokumentasikan dan pernah diuji.
- **Setelah deploy:** jalankan smoke test otomatis, lalu pantau error rate dan latency selama ±15–30 menit. Rollback otomatis atau manual kalau melewati ambang batas.
- **Graceful shutdown:** berhenti menerima request, selesaikan yang sedang berjalan, lalu tutup koneksi.

## 6. Config & secret

- Semua config lewat env atau config service. Config divalidasi saat startup (gagal cepat kalau ada yang hilang).
- **Secret** di secret manager (Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Doppler) atau CI environment secret. **Rotasi** secret secara berkala dan segera setelah bocor.
- Environment dev, staging, dan prod benar-benar terpisah: credential, database, dan akses berbeda.
- Kalau secret bocor ke git, **rotasi dulu**, baru bersihkan history. Menghapus history saja tidak cukup.

## 7. Nginx / reverse proxy

- HTTPS wajib (TLS 1.2+, lebih baik 1.3), sertifikat otomatis (Let's Encrypt), dan HTTP di-redirect ke HTTPS.
- Pasang header keamanan: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Content-Security-Policy` / `frame-ancestors`.
- Atur `client_max_body_size`, timeout, rate limit (`limit_req`), gzip/brotli, dan cache panjang untuk aset statis yang punya hash di nama file.
- Teruskan `X-Forwarded-For`/`X-Forwarded-Proto` dengan benar, dan pastikan aplikasi hanya memercayai proxy yang dikenal.
- Uji dengan `nginx -t` sebelum reload.

## 8. Kubernetes

- `resources.requests`/`limits`, `readinessProbe`, `livenessProbe` (dan `startupProbe` untuk aplikasi yang lambat start) wajib ada.
- **`securityContext`:**
  - `runAsNonRoot: true`
  - `readOnlyRootFilesystem: true`
  - `allowPrivilegeEscalation: false`
  - drop semua capability
- Config lewat ConfigMap, dan secret lewat External Secrets/Sealed Secrets (bukan Secret mentah di git).
- **Ketersediaan & isolasi:** HPA untuk beban yang naik-turun, PodDisruptionBudget, minimal 2 replika untuk service penting, dan NetworkPolicy default-deny.
- Manifest dikelola dengan Helm/Kustomize, dan idealnya di-deploy lewat **GitOps** (Argo CD / Flux). Selalu cek dengan `kubectl diff` sebelum apply.

## 9. Terraform / IaC

- **State & versi:**
  - State disimpan di remote backend dengan locking dan enkripsi. Jangan pernah commit state.
  - Versi Terraform dan provider dipin, dan `.terraform.lock.hcl` di-commit.
- **Struktur kode:**
  - Modul yang bisa dipakai ulang, dan folder/workspace terpisah per environment.
  - Tidak ada nilai hardcode. Pakai variabel dan output.
- **Alur:** `fmt -check` → `validate` → `tflint`/`checkov` → `plan` (hasilnya di-review di PR) → `apply` dari CI setelah approve.
- Tag semua resource (`env`, `service`, `owner`, `cost-center`) untuk pelacakan biaya.
- **Drift detection:** jalankan `plan` terjadwal untuk mendeteksi perubahan manual.

## 10. Observability

- **Tiga pilar:** log terstruktur, metric, dan trace, dengan OpenTelemetry sebagai standar instrumentasi.
- **Metric:**
  - **RED** (Rate, Errors, Duration) untuk service.
  - **USE** (Utilization, Saturation, Errors) untuk resource.
  - **Four golden signals:** latency, traffic, errors, saturation.
- Log dan trace dikumpulkan secara terpusat (Loki/ELK/CloudWatch, Tempo/Jaeger), dengan retensi yang jelas dan PII di-mask.
- **Dashboard** per service yang menjawab: apakah layanan sehat sekarang? apa yang berubah?
- Uptime check eksternal ke endpoint health.

## 11. SLO, alerting & incident

- **SLI** adalah ukuran yang penting bagi user (misalnya persentase request sukses < 300ms). **SLO** adalah targetnya (misalnya 99.9% per 30 hari).
- **Error budget** = 100% − SLO. Kalau budget habis, prioritaskan reliability dibanding fitur baru.
- **Alert:**
  - Berdasarkan **gejala yang dirasakan user** dan burn rate SLO, bukan setiap CPU spike.
  - Setiap alert harus bisa ditindaklanjuti dan punya **runbook**.
  - Alert yang sering berbunyi tanpa tindakan harus dihapus atau diperbaiki (cegah alert fatigue).
- **Incident:** pulihkan dulu (rollback, matikan feature flag, scale), baru investigasi. Postmortem bersifat blameless untuk SEV1–SEV2. Detailnya ada di skill `engineering-workflow`.

## 12. Backup & disaster recovery

- Tentukan **RPO** (berapa banyak data yang boleh hilang) dan **RTO** (berapa lama boleh down) untuk setiap sistem.
- **Backup:**
  - Otomatis dan terenkripsi, disimpan di lokasi/akun berbeda.
  - Mengikuti aturan 3-2-1 dengan retensi yang jelas.
  - Pakai point-in-time recovery untuk DB penting.
- **Restore diuji secara berkala.** Backup yang tidak pernah diuji restore dianggap tidak ada.

## 13. Metrik delivery (DORA)

Ukur performa delivery tim dengan 5 metrik DORA:

| Metrik | Jenis | Arti |
|---|---|---|
| Deployment frequency | Throughput | Seberapa sering deploy ke production |
| Lead time for changes | Throughput | Waktu dari commit sampai berjalan di production |
| Failed deployment recovery time | Throughput | Waktu pulih dari deploy yang gagal |
| Change failure rate | Stabilitas | Persentase deploy yang menyebabkan masalah |
| Deployment rework rate | Stabilitas | Persentase deploy yang tidak direncanakan akibat insiden |

Perubahan kecil, pipeline cepat, test otomatis, dan rollback yang mudah memperbaiki semua metrik ini sekaligus.

## 14. Biaya (FinOps)

- Right-size resource berdasarkan metric pemakaian nyata, bukan tebakan.
- Environment non-production dimatikan atau di-scale down di luar jam kerja.
- Pasang budget alert di akun cloud. Semua resource diberi tag supaya biaya bisa dilacak per service/tim.
