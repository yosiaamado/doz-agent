# Backend: Caching, Async Jobs & Observability

Additional `backend-patterns` rules. Read this **only if** your work touches caching, queues/background jobs, or logging/metrics/tracing.

## Caching

- Cache-aside pattern: read the cache → on a miss, read the DB → write to the cache with a TTL.
- Invalidate when the data changes. Keys carry a namespace and a version (`v1:order:123`).
- Don't put per-user or per-tenant data under a global key.
- Watch out for a **cache stampede:** use a lock or a TTL with jitter.
- Caching is for a measured performance problem, not something to sprinkle everywhere.

## Async & background jobs

- Slow work, or work the user doesn't need to wait for (email, reports, outgoing webhooks), goes onto a queue.
- Jobs must be **idempotent**, with retries using backoff, a dead-letter queue, and a time limit.
- Messages carry a unique ID so the consumer can deduplicate.
- Scheduled jobs (cron) must be safe if they run twice. Use a distributed lock where needed.

## Observability

- **Structured logs (JSON)** containing `timestamp`, `level`, `message`, `traceId`, `userId`/`tenantId` (where safe), and `durationMs`.
- **Log levels:**
  - `error`: needs action
  - `warn`: an anomaly that was handled
  - `info`: an important business event
  - `debug`: development only
- **Don't log** passwords, tokens, card numbers, OTPs, or PII that isn't needed. Mask it if it genuinely has to be recorded.
- **Tracing & metrics** via OpenTelemetry. RED metrics per endpoint: rate, errors, duration (p50/p95/p99).
- **Health checks:**
  - `/health/live`: the process is alive.
  - `/health/ready`: the DB/cache/dependencies are ready. Used by the load balancer.
- The `traceId` is propagated to other services and returned in error responses.
