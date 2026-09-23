# Backend: Caching, Async Job & Observability

Aturan tambahan `backend-patterns`. Baca **hanya kalau** pekerjaanmu menyentuh caching, queue/background job, atau logging/metric/tracing.

## Caching

- Pola cache-aside: baca cache → kalau miss, baca DB → tulis ke cache dengan TTL.
- Invalidasi saat data berubah. Key punya namespace dan versi (`v1:order:123`).
- Jangan menaruh data per-user atau per-tenant di key global.
- Waspadai **cache stampede:** pakai lock atau TTL dengan jitter.
- Cache hanya dipakai untuk masalah performa yang terukur, bukan dipasang di mana-mana.

## Async & background job

- Pekerjaan lambat atau yang tidak perlu ditunggu user (email, laporan, webhook keluar) dikirim ke queue.
- Job harus **idempotent**, punya retry dengan backoff, dead-letter queue, dan batas waktu.
- Message membawa ID unik supaya consumer bisa men-deduplikasi.
- Job terjadwal (cron) harus aman kalau berjalan dobel. Pakai lock terdistribusi kalau perlu.

## Observability

- **Log terstruktur (JSON)** yang berisi `timestamp`, `level`, `message`, `traceId`, `userId`/`tenantId` (kalau aman), dan `durationMs`.
- **Level log:**
  - `error`: butuh tindakan
  - `warn`: anomali yang ditangani
  - `info`: event bisnis penting
  - `debug`: hanya untuk development
- **Jangan log** password, token, nomor kartu, OTP, atau PII yang tidak perlu. Mask kalau memang harus dicatat.
- **Tracing & metric** pakai OpenTelemetry. Metric RED per endpoint: rate, errors, duration (p50/p95/p99).
- **Health check:**
  - `/health/live`: proses hidup.
  - `/health/ready`: DB/cache/dependency siap. Dipakai load balancer.
- `traceId` diteruskan ke layanan lain dan dikembalikan di response error.
