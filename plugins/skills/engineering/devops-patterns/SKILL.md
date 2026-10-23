---
name: devops-patterns
description: Use when creating or changing a Dockerfile, CI/CD pipeline, deploy configuration, infrastructure as code, secrets handling, monitoring or alerting, or when debugging a failed build or deploy.
---

# DevOps Patterns

This is a set of **default decisions** for things the project hasn't settled, not a tutorial. The project's existing setup **always wins**. Don't add a tool or pattern from here to a project that doesn't already use it, unless asked.

## 0. Safety

- Commands that touch a shared/production environment or are destructive (`terraform apply/destroy`, `kubectl apply/delete` against a remote, deploys, dropping a DB, `prune`, IAM/DNS/firewall changes) **are run only after the user confirms.** Run `plan`, `diff`, or `--dry-run` first and explain the impact.
- Secrets never reach git, images, logs, or CI output.
- Every infrastructure change goes through reviewed code (IaC), not manual clicks in a console.

## 1. Artifacts

Build once, deploy many: a single image tagged with the git SHA is promoted dev → staging → prod. Only the config (env) differs. Least privilege for CI tokens, IAM roles, containers, and DB access.

## 2. Docker

- The base image is pinned (production: down to the digest `@sha256:...`), minimal (alpine/distroless/chiseled), never `latest`, and updated via Dependabot/Renovate.
- Multi-stage build, non-root user, a `.dockerignore` (`.git`, `node_modules`, `bin/`, `obj/`, `.env*`, test output), layers ordered from rarely-changing to frequently-changing.
- One process per container, logs to stdout/stderr, SIGTERM handled, `HEALTHCHECK` pointing at `/health/live`.
- No secrets in `ARG`/`ENV`/image layers; a build needing a secret uses BuildKit `--mount=type=secret`.
- Images are scanned (Trivy/Grype) in CI; the build fails on any Critical/High that already has a fix available.

## 3. docker-compose (local dev)

DB/cache services use named volumes and a `healthcheck`, with `depends_on: condition: service_healthy`. Env from `.env` (in `.gitignore`), plus a complete `.env.example` with no secret values. One command (`docker compose up`), documented in the README.

## 4. CI/CD (GitHub Actions)

```
PR:   install (cache) → lint/format → type-check → unit tests → build → integration tests → scan (SAST, dependency, secret, image)
main: all of the above → build & push image (SHA tag) → deploy staging → smoke tests → approval → deploy prod → verify
```

- Target PR time < 10 minutes: cache dependencies and parallelise jobs. Branch protection on `main` (PR required, review, CI green).
- Minimal `permissions:` at the workflow level (`contents: read`), raised per job only where needed.
- Third-party actions pinned to a **full commit SHA** with the version in a comment (`uses: actions/checkout@<sha> # v4.2.2`), updated via Dependabot.
- Cloud auth via OIDC (`id-token: write`), not static access keys. Secrets per GitHub Environment, with required reviewers for production.
- **Don't use `pull_request_target`** with a checkout of the PR's code: secrets can leak to a fork PR. Use `concurrency` so deploys to the same environment don't collide.
- The lockfile is committed and installs are frozen (`npm ci`, `dotnet restore --locked-mode`). Release artifacts carry an SBOM (Syft/CycloneDX) and an attestation (`actions/attest-build-provenance`). Secret scanning + push protection enabled.

## 5. Deploy & release

- Rolling updates with a readiness probe; canary or blue-green for risky changes. Feature flags separate deploying from releasing to users.
- DB migrations run as a controlled step before the deploy, and are backward-compatible with the app version currently running (expand → contract).
- Rollback = redeploying the previous image SHA; the steps are documented and have been tested.
- After a deploy: automated smoke tests, then watch error rate and latency for ~15–30 minutes; roll back if it crosses the threshold. Graceful shutdown: stop accepting requests, finish the in-flight ones.

## 6. Config & secrets

Config comes from the environment, validated at startup (fail fast if something's missing). Secrets live in a secret manager or CI environment secrets, and are rotated on a schedule. Dev, staging, and prod are completely separate (credentials, database, access). A secret leaked into git → **rotate first**, then clean up the history.

## 7. Nginx / reverse proxy

HTTPS (TLS 1.2+, automatic certificates, HTTP redirected) · the `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Content-Security-Policy`/`frame-ancestors` headers · `client_max_body_size`, timeouts, `limit_req`, gzip/brotli, and long cache lifetimes for hash-named assets · `X-Forwarded-For`/`X-Forwarded-Proto` passed through, and the app trusting only known proxies · `nginx -t` before a reload.

## 8. Kubernetes

`resources.requests`/`limits`, `readinessProbe`, `livenessProbe` (plus a `startupProbe` for slow-starting apps) · `securityContext`: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, drop all capabilities · config via ConfigMaps, secrets via External Secrets/Sealed Secrets (not raw Secrets in git) · important services: at least 2 replicas, a PodDisruptionBudget, an HPA for variable load, a default-deny NetworkPolicy · Helm/Kustomize, ideally GitOps (Argo CD/Flux); `kubectl diff` before apply.

## 9. Terraform / IaC

State in a remote backend with locking and encryption, never committed · Terraform and provider versions pinned, `.terraform.lock.hcl` committed · reusable modules, a folder/workspace per environment, no hardcoded values · the flow: `fmt -check` → `validate` → `tflint`/`checkov` → `plan` (reviewed in the PR) → `apply` from CI after approval · every resource tagged (`env`, `service`, `owner`, `cost-center`) · a scheduled `plan` to detect drift.

## 10. Observability, alerts & incidents

- Structured logs, metrics, and traces via OpenTelemetry; logs & traces centralised with a clear retention policy and PII masked. RED metrics per service, USE per resource. A dashboard per service and an external uptime check against the health endpoint.
- Alerts based on user-visible symptoms and SLO burn rate, not on every CPU spike. Every alert is actionable and has a runbook; an alert that fires often without anyone acting is deleted or fixed. Error budget exhausted → prioritise reliability over new features.
- Incidents: recover first (roll back, kill the feature flag, scale), investigate after. Blameless postmortems for SEV1–SEV2; the details are in the `engineering-workflow` skill.

## 11. Backup, DR & cost

- Every system has an RPO and an RTO. Backups are automated, encrypted, in a different location/account (3-2-1) with a clear retention policy, plus point-in-time recovery for important DBs. **Restores are tested regularly**; a backup whose restore has never been tested counts as no backup at all.
- Right-size resources from real usage metrics, scale non-production down outside working hours, and set budget alerts on the cloud account.
