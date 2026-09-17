---
name: devops-patterns
description: Aturan dan best practice DevOps (Docker, docker-compose, CI/CD GitHub Actions, deployment & rollback, environment/secret, Nginx, Kubernetes, Terraform, monitoring & logging). Pakai saat membuat atau mengubah Dockerfile, pipeline CI/CD, konfigurasi deploy, infrastruktur, atau saat debugging build/deploy.
---

# DevOps Patterns

Setup yang sudah ada di project **selalu menang**. Pakai aturan ini sebagai default.

## 0. Aturan keselamatan

- Perintah yang menyentuh production atau bersifat destruktif (`terraform apply/destroy`, `kubectl delete`, deploy, drop DB, `prune`) **hanya dijalankan setelah user konfirmasi.** Jalankan `plan`, `--dry-run`, atau `diff` dulu.
- Secret tidak pernah masuk git, image, atau log.

## 1. Docker

```dockerfile
# build stage
FROM node:20.11-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# runtime stage
FROM node:20.11-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
```

- Pin versi base image (jangan `latest`). Pakai multi-stage build dan user non-root.
- Sediakan `.dockerignore` (`node_modules`, `.git`, `.env`, `dist`).
- Urutkan layer dari yang jarang berubah (dependency) ke yang sering berubah (source).
- Satu proses per container. Log ditulis ke stdout/stderr.

## 2. docker-compose (dev lokal)

- Service DB/cache pakai volume bernama dan `healthcheck`, dan `depends_on` memakai `condition: service_healthy`.
- Env diambil dari `.env` (tidak di-commit). Sediakan `.env.example`.

## 3. CI/CD (GitHub Actions)

- Urutan: install (dengan cache) → lint → type-check → test → build → scan → deploy.
- Pull request cukup menjalankan CI. Deploy hanya dari `main` atau tag, dengan `environment` dan approval untuk production.
- `permissions:` minimal (default `contents: read`). Action pihak ketiga dipin ke versi atau SHA.
- Secret diambil dari GitHub Secrets/Environments, dan untuk cloud pakai OIDC, bukan key statis.
- Pakai `concurrency` supaya deploy tidak saling tabrak.
- Image di-tag dengan git SHA (bukan hanya `latest`) supaya bisa di-rollback.

## 4. Deployment

- Strategi: rolling atau blue-green, dengan healthcheck/readiness sebelum menerima traffic.
- Migration DB dijalankan sebagai langkah terpisah sebelum deploy, dan harus backward-compatible dengan versi lama.
- Rollback cukup dengan deploy ulang image SHA sebelumnya, dan langkahnya didokumentasikan.
- Aplikasi menangani graceful shutdown (SIGTERM): berhenti menerima request dan menyelesaikan yang sedang berjalan.

## 5. Config & secret

- Ikuti prinsip 12-factor: semua config lewat env. Env divalidasi saat startup (gagal cepat).
- Secret di secret manager (Vault, AWS SM, GCP SM, Doppler) atau CI secrets.
- Pisahkan env dev, staging, dan prod, dan jangan pakai credential yang sama.

## 6. Nginx / reverse proxy

- HTTPS wajib (Let's Encrypt), dan HTTP di-redirect ke HTTPS.
- Pasang header keamanan: HSTS, `X-Content-Type-Options`, `X-Frame-Options`/CSP.
- Atur `client_max_body_size` dan timeout yang wajar, gzip/brotli, serta cache untuk aset statis.
- Uji dengan `nginx -t` sebelum reload.

## 7. Kubernetes

- `resources.requests`/`limits`, `readinessProbe`, dan `livenessProbe` wajib ada.
- Config lewat ConfigMap, secret lewat Secret atau External Secrets.
- Pasang HPA untuk service yang bebannya naik-turun, PodDisruptionBudget, dan `securityContext` non-root dengan read-only root filesystem.
- Manifest dikelola lewat Helm atau Kustomize, dan dicek dengan `kubectl diff` sebelum apply.

## 8. Terraform / IaC

- State disimpan di remote backend dengan locking.
- Kode dipecah per modul dan per environment. Versi provider dipin.
- Alur: `fmt` → `validate` → `plan` (di-review) → `apply`.
- Tidak ada perubahan manual di console tanpa ditulis balik ke kode.

## 9. Observability

- Log terstruktur JSON dengan `requestId`, dikumpulkan secara terpusat (Loki, ELK, CloudWatch).
- Metric pakai pola RED (Rate, Errors, Duration) dan USE untuk resource.
- Alert hanya untuk hal yang bisa ditindaklanjuti, dan setiap alert punya runbook.
- Uptime check eksternal ke endpoint `/health`.

## 10. Backup

- Backup DB otomatis dengan retensi yang jelas, dan **restore diuji secara berkala.**
